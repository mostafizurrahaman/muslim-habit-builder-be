import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { ContentService } from './content.service';

const createContentOrUpdate = asyncHandler(async (req: Request, res: Response) => {
  const result = await ContentService.createOrUpdatePage(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Content Created Successfully!',
    data: result,
  });
});

const getAllContent = asyncHandler(async (req, res) => {
  const result = await ContentService.getAllContent();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Content data retrieved Successfully!',
    data: result,
  });
});

const getContentByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const result = await ContentService.getContentByType(type as string);
  
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Content data retrieved Successfully!',
    data: result,
  });
});


export const ContentController = {
  createContentOrUpdate,
  getAllContent,
  getContentByType,
};
