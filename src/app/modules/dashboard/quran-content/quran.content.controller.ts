import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { TQuranContentImages } from "./quran.content.interface";
import { quranContentService } from "./quran.content.service";
import asyncHandler from "../../../../shared/asynchandler";
import sendResponse from "../../../../shared/sendResponse";



const createQuranContentIntoDb = asyncHandler(async (req: Request, res: Response) => {

    const result = await quranContentService.createQuranContent(req.body, req.files as TQuranContentImages);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Quran content has been created successfully',
        data: result,
    });
});


const getQuranContentsIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await quranContentService.getQuranContents();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran contents retrieved successfully',
        data: result,
    });
});

const updateQuranContentIntoDb = asyncHandler(async (req: Request, res: Response) => {
     
    const result = await quranContentService.updateQuranContent(req.params.id as string, req.body);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran content has been updated successfully',
        data: result,
    });
});

const deleteQuranContentIntoDb = asyncHandler(async (req: Request, res: Response) => {
    const result = await quranContentService.deleteQuranContent(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran content has been deleted successfully',
        data: result,
    });
});

const getSingleQuranContentIntoDb = asyncHandler(async (req: Request, res: Response) => {

    const result = await quranContentService.getSingleQuranContent(req.params.id as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran content has been retrieved successfully',
        data: result,
    });
});

const getQuranContentPreview = asyncHandler(async (req: Request, res: Response) => {

    const result = await quranContentService.getQuranContentPreview(req.params.id as string, parseInt(req.query.index as string));
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran content has been retrieved successfully',
        data: result,
    });
});

const addVerseInQuranContent = asyncHandler(async (req: Request, res: Response) => {

    const result = await quranContentService.addVerse(req.params.id as string, req.files as TQuranContentImages);
    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: 'Quran verse added successfully',
        data: result,
    });
});

const reOrderVerseInQuranContent = asyncHandler(async (req: Request, res: Response) => {
    const result = await quranContentService.reorderVerseImages(req.params.id as string, req.body);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran verse order updated successfully',
        data: result,
    });
});

const deleteVerseImageInQuranContent = asyncHandler(async (req: Request, res: Response) => {
    const result = await quranContentService.deleteVerseImage(req.params.id as string, req.body.imageUrl as string);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran verse image deleted successfully',
        data: result,
    });
});

const replaceVerseImageInQuranContent = asyncHandler(async (req: Request, res: Response) => {
    const result = await quranContentService.replaceVerseImage(req.params.id as string, req.body.imageUrl as string, req.files as TQuranContentImages);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran verse image replaced successfully',
        data: result,
    });
});

const getQuranContentNames = asyncHandler(async (req: Request, res: Response) => {
    const result = await quranContentService.getQuranContentNames();
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: 'Quran content names retrieved successfully',
        data: result,
    });
});

export const quranContentController = {
    createQuranContentIntoDb,
    getSingleQuranContentIntoDb,
    getQuranContentPreview,
    getQuranContentsIntoDb,
    addVerseInQuranContent,
    reOrderVerseInQuranContent,
    deleteQuranContentIntoDb,
    deleteVerseImageInQuranContent,
    replaceVerseImageInQuranContent,
    getQuranContentNames,
    updateQuranContentIntoDb
};
