import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import asyncHandler from '../../../shared/asynchandler';
import sendResponse from '../../../shared/sendResponse';
import { ContactDetailService } from './contact.detail.service';

const createContactDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await ContactDetailService.createContactDetail(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Contact details created successfully!',
    data: result,
  });
});

const updateContactDetail = asyncHandler(async (req: Request, res: Response) => {
  const id = typeof req.params.id === 'string' ? req.params.id : undefined;
  const result = await ContactDetailService.updateContactDetail(req.body, id);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Contact details updated successfully!',
    data: result,
  });
});

const getContactDetail = asyncHandler(async (_req: Request, res: Response) => {
  const result = await ContactDetailService.getContactDetail();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Contact details retrieved successfully!',
    data: result,
  });
});

export const ContactDetailController = {
  createContactDetail,
  updateContactDetail,
  getContactDetail,
};
