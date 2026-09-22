import { BadRequestError } from "../../../errors/request/apiError";
import { Announcement } from "./announcement.model";
import { TAnnouncementPayload, TUpdateAnnouncementPayload } from "./announcement.zod";
import User from "../../user/user.model";
import { USER_STATUS } from "../../user/user.constant";
import { notificationServices } from "../../Notification/notification.services";


const addAnnouncement = async (payload: TAnnouncementPayload) => {

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // 2. Set default status
    const newPayload = {
        ...payload,
        status: 'Scheduled'
    };

    // 3. Prevent duplicates
    const duplicateAnnouncement = await Announcement.findOne({
        title: payload.title,
        description: payload.description,
        startedAt: payload.startedAt,
        endedAt: payload.endedAt,
    });

    if (duplicateAnnouncement) {
        throw new BadRequestError("Announcement already exists");
    }



    // 4. Safely compare start/end dates normalized to midnight
    const startDate = new Date(payload.startedAt);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(payload.endedAt);
    endDate.setHours(0, 0, 0, 0);


    if (todayDate >= startDate && todayDate >= endDate) {
        throw new BadRequestError("end date must be greater than today");
    }
    // If today is on or after the start date, AND on or before the end date -> Active
    if (todayDate >= startDate && todayDate <= endDate) {
        newPayload.status = 'Active';
    }

    // 5. Create and save (Announcement.create already saves, so just return it directly!)
    const announcement = await Announcement.create(newPayload);

    // Broadcast notification to all active users:
    (async () => {
        try {
            const users = await User.find({ status: USER_STATUS.ACTIVE }).select('_id');
            if (users.length > 0) {
                const userIds = users.map((u) => u._id);
                await notificationServices.createNotificationForMultipleUser(
                    {
                        title: `New Announcement: ${announcement.title}`,
                        message: announcement.description || 'Check out the latest announcement in the app!',
                        notificationType: 'ANNOUNCEMENT',
                        meta: { announcementId: announcement._id.toString() },
                    },
                    userIds,
                );
            }
        } catch (err) {
            console.error('[AnnouncementService] Failed to send announcement notifications:', err);
        }
    })();

    return announcement;
}

const getAllAnnouncements = async (query: Record<string, unknown>) => {
    const { page = 1, limit = 10, searchTerm, status } = query;

    const matchStage: any = {};

    // Status filter
    if (status) {
        matchStage.status = { $regex: status, $options: 'i' };
    }


    // Search Term logic add kora hoyeche
    if (searchTerm) {
        matchStage.$or = [
            { title: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } }
        ];
    }

    const result = await Announcement.aggregate([
        { $match: matchStage },
        {
            $facet: {
                data: [
                    { $sort: { createdAt: -1 } },
                    { $skip: (Number(page) - 1) * Number(limit) },
                    { $limit: Number(limit) },
                    {
                        $project: {
                            title: 1,
                            description: 1,
                            startedAt: 1,
                            endedAt: 1,
                            status: 1,
                        },
                    },
                ],
                total: [{ $count: 'count' }],
            },
        },
    ]);

    // Data handling securely check kora hoyeche jeno array empty thakle crash na kore
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

const updateAnnouncement = async (
    announcementId: string,
    payload: Partial<TUpdateAnnouncementPayload>
) => {
    // 1. Fetch the existing document to handle partial updates cleanly
    const existingAnnouncement = await Announcement.findById(announcementId);
    if (!existingAnnouncement) {
        throw new BadRequestError("Announcement not found");
    }

    const finalStartedAt = payload.startedAt
        ? new Date(payload.startedAt)
        : new Date(existingAnnouncement.startedAt!); 

    const finalEndedAt = payload.endedAt
        ? new Date(payload.endedAt)
        : new Date(existingAnnouncement.endedAt!);

    // Guard against invalid date formats
    if (isNaN(finalStartedAt.getTime()) || isNaN(finalEndedAt.getTime())) {
        throw new BadRequestError("Invalid date format provided");
    }

    // Normalize dates to midnight for date-only comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(finalStartedAt);
    start.setHours(0, 0, 0, 0);

    const end = new Date(finalEndedAt);
    end.setHours(0, 0, 0, 0);

    // 3. Date Validations
    if (end < start) {
        throw new BadRequestError("End date cannot be earlier than the start date");
    }

    if (end < today) {
        throw new BadRequestError("End date must be today or in the future");
    }

    // 4. Determine Dynamic Status
    let status: 'Scheduled' | 'Active' = 'Scheduled';
    if (today >= start && today <= end) {
        status = 'Active';
    }

    // 5. Build safe payload and execute update
    const newPayload = {
        ...payload,
        status
    };

    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
        announcementId,
        { $set: newPayload },
        { new: true, runValidators: true }
    );

    return updatedAnnouncement;
};


const deleteAnnouncement = async (announcementId: string) => {
    const deletedAnnouncement = await Announcement.deleteOne({ _id: announcementId });
    if(deletedAnnouncement.deletedCount === 0) {
        throw new BadRequestError("Failed to delete announcement");
    }
    return deletedAnnouncement;
};

export const announcementService = {
    addAnnouncement,
    getAllAnnouncements,
    updateAnnouncement,
    deleteAnnouncement
};



