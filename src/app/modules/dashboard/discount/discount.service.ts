import { BadRequestError } from '../../../errors/request/apiError';
import { IDiscount } from './discount.interface';
import { Discount } from './discount.model';
import { TDiscountPayload } from './discount.zod';
import User from '../../user/user.model';
import { USER_STATUS } from '../../user/user.constant';
import { notificationServices } from '../../Notification/notification.services';

// 1. Create Discount
const createDiscount = async (payload: TDiscountPayload) => {
    const isExist = await Discount.findOne({ code: payload.code });
    if (isExist) {
        throw new BadRequestError('Discount code already exists!');
    }

    const newPayload = {
        ...payload,
        discountString: `${payload.discount}% OFF`,
    };
    const result = await Discount.create(newPayload);

    // Broadcast discount notification to active users:
    (async () => {
        try {
            const activeUsers = await User.find({ status: USER_STATUS.ACTIVE }).select('_id');
            if (activeUsers.length > 0) {
                const userIds = activeUsers.map((u) => u._id);
                await notificationServices.createNotificationForMultipleUser(
                    {
                        title: `Special Offer: ${result.discount}% OFF!`,
                        message: `Enjoy ${result.discount}% discount on ${result.appliesTo} plan! Use promo code: ${result.code}`,
                        notificationType: 'ANNOUNCEMENT',
                        meta: { discountCode: result.code, appliesTo: result.appliesTo },
                    },
                    userIds,
                );
            }
        } catch (err) {
            console.error('[DiscountService] Failed to send discount notifications:', err);
        }
    })();

    return result;
};

// 2. Get All Discounts (with simple filtering/pagination if needed)
const getAllDiscounts = async (query: Record<string, unknown>) => {
    const { page = 1, limit = 10, searchTerm, status, plan } = query;

    const matchStage: any = {};

    // Status filter
    if (status) {
        matchStage.status = { $regex: status, $options: 'i' };
    }

    if (plan) {
        matchStage.appliesTo = { $regex: plan, $options: 'i' };
    }


    // Search term logic has been added
    if (searchTerm) {
        matchStage.$or = [
            { title: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } }
        ];
    }

    const result = await Discount.aggregate([
        { $match: matchStage },
        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: (Number(page) - 1) * Number(limit) },
                    { $limit: Number(limit) },
                    {
                        $project: {
                            code: 1,
                            discountString: 1,
                            usageLimit: 1,
                            totalUsage: 1,
                            appliesTo: 1,
                            validFrom: 1,
                            validUntil: 1,
                            status: 1,
                        },
                    },
                ],
                total: [{ $count: 'count' }],
            },
        },
    ]);

    // Data handling is checked safely so it does not crash when the array is empty
    const users = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    const data = users.map((user: any) => ({
        ...user,
    }));

    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
        },
        data,
    };
};

// 3. Get Single Discount by ID or Code
const getDiscountById = async (id: string): Promise<IDiscount | null> => {
    const result = await Discount.findById(id);
    if (!result) {
        throw new BadRequestError('Discount not found!');
    }
    return result;
};

// 4. Update Discount
const updateDiscount = async (id: string, payload: Partial<IDiscount>): Promise<IDiscount | null> => {

    if (payload.code) {
        const isExist = await Discount.findOne({ code: payload.code, _id: { $ne: id } });
        if (isExist) {
            throw new BadRequestError('Discount code already taken by another coupon!');
        }
    }

    const newPayload = {
        ...payload,
        discountString: `${payload.discount}% OFF`,
    }

    const result = await Discount.findByIdAndUpdate(id, newPayload, {
        new: true,
        runValidators: true
    });

    if (!result) {
        throw new BadRequestError('Discount not found to update!');
    }
    return result;
};

// 5. Delete Discount
const deleteDiscount = async (id: string)=> {
    const result = await Discount.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
        throw new BadRequestError('Discount not found to delete!');
    }
    return null;
};

export const discountService = {
    createDiscount,
    getAllDiscounts,
    getDiscountById,
    updateDiscount,
    deleteDiscount
};