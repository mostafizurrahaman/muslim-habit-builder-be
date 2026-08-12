

import mongoose from "mongoose";
import { deleteImageFromCloudinary } from "../../../../cloudinary/deleteImageFromCloudinary";
import { uploadToCloudinary } from "../../../../cloudinary/uploadImageToCLoudinary";
import { NotFoundError } from "../../../errors/request/apiError";
import { HabitTemplate } from "../habit-template/system.habit.model";
import { TQuranContentImages } from "./quran.content.interface";
import { QuranContent } from "./quran.content.model";
import { TQuranContentPayload, TQuranContentUpdatePayload } from "./quran.content.zod";


// create quran content
const createQuranContent = async (
    payload: TQuranContentPayload,
    files: TQuranContentImages
) => {

    let uploadedVerseImages: string[] = [];

    try {

        if (files?.pages?.length) {
            const uploads = await Promise.all(
                files.pages.map((file) => uploadToCloudinary(file, 'quran_verse'))
            )
            uploadedVerseImages = uploads.map((img) => img.secure_url);
        }

        const refinedImages = uploadedVerseImages.map((url, index) => ({
            order: index + 1,
            imageUrl: url,
        }));

        const versePayload = {
            ...payload,
            images: refinedImages,
            pages: refinedImages.length,
        };

        const result = await QuranContent.create(versePayload)

        return result;
    } catch (error) {
        // 8. Rollback DB
        if (uploadedVerseImages.length) {
            await Promise.all(
                uploadedVerseImages.map((url) => deleteImageFromCloudinary(url))
            );
        }
        throw error;
    }
};

// get quran content list

const getQuranContents = async () => {
    const result = await QuranContent.find({ isDeleted: false }).select('name _id pages');
    return result.map(item => {
        return {
            id: item._id,
            name: item.name,
            pages: item.pages
        }
    });
}

// delete quran content
const deleteQuranContent = async (id: string) => {
    // 1. Start a Mongoose session
    const session = await mongoose.startSession();

    // 2. Start the transaction
    session.startTransaction();

    try {
        // Find the content (using session is a good practice here)
        const quran = await QuranContent.findById(id).session(session);

        if (!quran) {
            throw new NotFoundError("Content not found");
        }

        const deletedImages = quran.images.map(img => img.imageUrl) || [];

        // Delete images from Cloudinary
        await Promise.all(
            deletedImages.map((url) => deleteImageFromCloudinary(url))
        );

        await HabitTemplate.findOneAndUpdate({ quranContent: id }, { $unset: { quranContent: null }, new: true }).session(session);
        quran.images = [];

        await quran.save({ session })
        // If everything is successful, commit the transaction
        await session.commitTransaction();

        return null;

    } catch (error) {
        // If any error occurs (DB or Cloudinary), rollback the transaction
        await session.abortTransaction();
        throw error; // Re-throw the error for the global error handler

    } finally {
        // End the session in the finally block so it always runs
        session.endSession();
    }
};

// update quran content
const updateQuranContent = async (id: string, payload: TQuranContentUpdatePayload) => {
    const result = await QuranContent.findByIdAndUpdate(id, payload, { new: true, runValidators: true });

    if (!result) {
        throw new NotFoundError("Quran content not found to update");
    }
    return null;
}


// get single quran content
const getSingleQuranContent = async (id: string) => {
    const result = await QuranContent.findById(id);
    if (!result) {
        throw new NotFoundError("Quran content not found");
    }
    return result;
};

// get quran content preview
const getQuranContentPreview = async (id: string, index: number) => {
    const result = await QuranContent.findById(id).select('name images');
    if (!result) {
        throw new NotFoundError("Quran content not found");
    }

    const image = result.images[index];
    if (!image) {
        throw new NotFoundError("Image not found");
    }
    return {
        name: result.name,
        image
    };
}

// add verse
const addVerse = async (
    id: string,
    files: TQuranContentImages
) => {

    const existingContent = await QuranContent.findById(id).select('images');

    if (!existingContent) {
        throw new NotFoundError("Quran content not found");
    }

    let uploadedVerseImages: string[] = [];

    try {

        if (files?.pages?.length) {
            const uploads = await Promise.all(
                files.pages.map((file) => uploadToCloudinary(file, 'quran_verse'))
            )
            uploadedVerseImages = uploads.map((img) => img.secure_url);
        }

        const refinedImages = uploadedVerseImages.map((url, index) => ({
            order: existingContent.images.length + index + 1,
            imageUrl: url,
        }));


        existingContent.images.push(...refinedImages);

        await existingContent.save();

        return existingContent.images[existingContent.images.length - refinedImages.length]; // return the last added image

    } catch (error) {
        // 8. Rollback DB
        if (uploadedVerseImages.length) {
            await Promise.all(
                uploadedVerseImages.map((url) => deleteImageFromCloudinary(url))
            );
        }
        throw error;
    }
};

// reorder the image
const reorderVerseImages = async (
    id: string,
    newOrder: { imageUrl: string; order: number }
) => {
    // 1. Fetch the full document to update fields cleanly
    const existingContent = await QuranContent.findById(id);

    if (!existingContent) {
        throw new NotFoundError("Quran content not found");
    }

    // 2. Find the target image that needs to be reordered
    const targetImage = existingContent.images.find(
        (image) => image.imageUrl === newOrder.imageUrl
    );

    if (!targetImage) {
        throw new NotFoundError("Image with the specified URL not found");
    }

    // Keep track of the target image's old order position
    const oldOrder = targetImage.order;
    const targetNewOrder = newOrder.order;

    // 3. Swap logic: Find the image currently occupying the target position 
    // and move it to the target image's original position
    existingContent.images.forEach((image) => {
        if (image.imageUrl !== newOrder.imageUrl && image.order === targetNewOrder) {
            image.order = oldOrder;
        }
    });

    // 4. Assign the new order position to the target image
    targetImage.order = targetNewOrder;

    // 5. Fix Array Index: Sort the actual array elements based on the updated 'order' property
    // Mongoose requires a re-assignment or explicit sort to track index changes correctly
    existingContent.images = existingContent.images.sort((a, b) => a.order - b.order);

    // 6. Persist the changes safely in the database
    await existingContent.save();

    return existingContent;
};

// delete verse image
const deleteVerseImage = async (id: string, imageUrlToDelete: string) => {
    // 1. Fetch the full document
    const existingContent = await QuranContent.findById(id);

    if (!existingContent) {
        throw new NotFoundError("Quran content not found");
    }

    // 2. Find the index of the image that needs to be deleted
    const targetIndex = existingContent.images.findIndex(
        (image) => image.imageUrl === imageUrlToDelete
    );

    if (targetIndex === -1) {
        throw new NotFoundError("Image not found in this content");
    }

    const deletedOrder = existingContent.images[targetIndex].order;

    // 3. Use standard array .splice() instead of Mongoose .pull()
    // Mongoose subdocument arrays track .splice() natively!
    existingContent.images.splice(targetIndex, 1);

    // 4. Shift logic: Update the order of the remaining images directly.
    existingContent.images.forEach((image) => {
        if (image.order > deletedOrder) {
            image.order -= 1;
        }
    });

    // 5. Save the document safely
    await existingContent.save();

    return existingContent;
};

// replace image
const replaceVerseImage = async (
    id: string,
    oldImageUrl: string,
    files: TQuranContentImages
) => {
    let newUploadedUrls: string[] = [];

    try {

        const existingContent = await QuranContent.findById(id);
        if (!existingContent) {
            throw new NotFoundError("Quran content not found");
        }


        const targetIndex = existingContent.images.findIndex(
            (image) => image.imageUrl === oldImageUrl
        );

        if (targetIndex === -1) {
            throw new NotFoundError("Old image URL not found in this content");
        }


        if (!files?.pages?.length) {
            throw new NotFoundError("No new image file provided for replacement");
        }

        const uploads = await Promise.all(
            files.pages.map((file) => uploadToCloudinary(file, 'quran_verse'))
        );
        newUploadedUrls = uploads.map((img) => img.secure_url);


        await deleteImageFromCloudinary(oldImageUrl);


        existingContent.images[targetIndex].imageUrl = newUploadedUrls[0];

        await existingContent.save();

        return existingContent;

    } catch (error) {

        if (newUploadedUrls.length > 0) {
            await Promise.all(
                newUploadedUrls.map((url) => deleteImageFromCloudinary(url))
            );
        }

        throw error;
    }
};

const getQuranContentNames = async () => {
    const result = await QuranContent.find().select('name _id');
    return result.map(item => {
        return {
            id: item._id,
            name: item.name
        }
    });
}

export const quranContentService = {
    createQuranContent,
    getSingleQuranContent,
    updateQuranContent,
    getQuranContentPreview,
    addVerse,
    getQuranContents,
    reorderVerseImages,
    deleteQuranContent,
    deleteVerseImage,
    replaceVerseImage,
    getQuranContentNames
};