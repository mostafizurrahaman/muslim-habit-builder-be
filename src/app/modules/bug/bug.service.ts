import QueryBuilder from "../../../builder/QueryBuilder";
import { deleteImageFromCloudinary } from "../../../cloudinary/deleteImageFromCloudinary";
import { uploadToCloudinary } from "../../../cloudinary/uploadImageToCLoudinary";
import { BadRequestError } from "../../errors/request/apiError";
import { IUser } from "../user/user.interface";
import { TBugStatus } from "./bug.constant";
import { TBugImage } from "./bug.interface";
import { Bug } from "./bug.model";
import { TBugReportPayload } from "./bug.zod";


// check existing bug
const checkExistingBugs = async (user: IUser, featureKey: string) => {

    if (!featureKey) {
        throw new BadRequestError("Feature key is required to check for existing bugs.");
    }

    const issues = await Bug.find({
        featureKey: featureKey as string,
        originalReporter: { $ne: user._id }, // Exclude bugs reported by the current user
        status: "pending"
    })
        .select("title description")
        .sort({ upvoteCount: -1 }); // Show top upvoted bugs first

    return issues;
}


// upvote existing bug
export const upvoteExistingBug = async (user: IUser, bugId: string) => {

    const isAlreadyUpvoted = await Bug.findOne({
        _id: bugId,
        upvotedBy: user._id
    });

    if (isAlreadyUpvoted) {
        throw new BadRequestError("You have already upvoted this bug!");
    }

    const updatedBug = await Bug.findByIdAndUpdate(
        bugId,
        { $inc: { upvoteCount: 1 }, $push: { upvotedBy: user._id } },
        { new: true }
    );

    if (!updatedBug) {
        throw new BadRequestError("Bug log not found");
    }
    return updatedBug;
};


// create fresh bug
const createFreshBug = async (user: IUser, payload: TBugReportPayload, files?: TBugImage) => {

    const { featureKey, title, description } = payload;

    let uploadedBugImages: string[] = [];

    try {
        if (files?.bug_images?.length) {
            const uploads = await Promise.all(
                files.bug_images.map((file) => uploadToCloudinary(file, 'bug_images'))
            )
            uploadedBugImages = uploads.map((img) => img.secure_url);
        }
    } catch (error) {
        if (uploadedBugImages.length > 0) {
            await Promise.all(
                uploadedBugImages.map((img) => deleteImageFromCloudinary(img))
            );
        }
        throw new Error(`Cloudinary upload crashed! Rollback completed. Error: ${error}`);
    }

    const newBug = await Bug.create({
        originalReporter: user._id,
        featureKey,
        title: title.trim(),
        description: description.trim(),
        bugImages: uploadedBugImages || [],
    });

    if (!newBug) {

        if (uploadedBugImages.length > 0) {
            await Promise.all(
                uploadedBugImages.map((img) => deleteImageFromCloudinary(img))
            );
        }
        throw new BadRequestError("Failed to create bug report");
    }

    return newBug;

};



// delete bug
const deleteBug = async (bugId: string) => {
    const bug = await Bug.findById(bugId);

    if (!bug) {
        throw new BadRequestError("Bug not found");
    }
    if (bug.status !== 'resolved') {
        throw new BadRequestError("Only resolved bugs can be deleted");
    }

    const bugImages = bug.bugImages || [];

    if (bug.bugImages && bug.bugImages.length > 0) {
        await Promise.all(
            bug.bugImages.map((img) => deleteImageFromCloudinary(img))
        );
    }
    const deletedBug = await Bug.deleteOne({ _id: bugId });

    if (deletedBug.deletedCount === 0) {
        bug.bugImages = bugImages;
        await bug.save();
        throw new BadRequestError("Failed to delete bug report");
    }

    return null;
}

// get all bugs for admin
const getAllBugsForAdmin = async (query: Record<string, unknown>) => {
    const baseQuery = Bug.find().populate({
        path: 'originalReporter',
        select: 'fullName email',
    });

    const builder = new QueryBuilder(baseQuery, query);

    builder.search(['title', 'description', 'featureKey']).filter().sort().paginate().fields();

    const data = await builder.modelQuery.exec();
    const meta = await builder.countTotal();

    return {
        meta: {
            page: meta.page,
            limit: meta.limit,
            total: meta.total,
            totalPages: meta.totalPage,
        },
        data,
    };
}

// update bug status
const updateStatus = async (bugId: string, status: TBugStatus) => {
    const bug = await Bug.findByIdAndUpdate(
        bugId,
        { status },
        { new: true, runValidators: true }
    );

    if (!bug) {
        throw new BadRequestError("Bug not found");
    }

    return bug;
};


export const bugServices = {
    checkExistingBugs,
    upvoteExistingBug,
    createFreshBug,
    deleteBug,
    getAllBugsForAdmin,
    updateStatus,
}
