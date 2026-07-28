import { Bug } from "../../bug/bug.model";
import { SUBSCRIPTION_STATUS } from "../../subscription/subscription.constant";
import Subscription from "../../subscription/subscription.model";
import User from "../../user/user.model";
import { Announcement } from "../announcement/announcement.model";
import { Discount } from "../discount/discount.model";
import { HabitTemplate } from "../habit-template/system.habit.model";


const getStatsOverview = async () => {
    const [premiumUsers, users, totalUsers,totalHabits,totalAnnouncement,totalDiscounts,totalBugReports] = await Promise.all([
        Subscription.aggregate([
            {
                $match: {
                    status: SUBSCRIPTION_STATUS.ACTIVE
                }
            },
        ]),
        User.find({})
            .lean(),

        User.countDocuments({}),

        HabitTemplate.countDocuments({}),
        Announcement.countDocuments({}),
        Discount.countDocuments({}),
        Bug.countDocuments({}),

    ]);

    const activeAccountUsers = users.filter((u) => u.status === 'active').length;
    const blockedAccountUsers = users.filter((u) => u.status === 'blocked').length;


    return {
        totalUsers: totalUsers,
        activeAccounts: activeAccountUsers,
        blockedAccounts: blockedAccountUsers,
        premiumUsers: premiumUsers.length,
        totalHabits: totalHabits,
        totalAnnouncement: totalAnnouncement,
        totalBugReports: totalBugReports,
        totalDiscounts: totalDiscounts
    };
}
    

const getRecentUsers = async () => {
    const users = await User.find({
        deletedAt: { $eq: null },
        role: { $nin: ['admin', 'super-admin'] }
    })
        .select('fullName avatar email city status plan createdAt ')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    return users.map(user => ({
        fullName: user.fullName,
        avatar: user.avatar,
        email: user.email ? user.email : 'N/A',
        status: user.status,
        createdAt: user.createdAt
    }));

};

const getUserGrowth = async (year: number) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const growthData = await User.aggregate([
        {
            $match: {
                deletedAt: { $eq: null },
                currentRole: { $nin: ['admin', 'super-admin'] },
                createdAt: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31T23:59:59`)
                }
            }
        },
        {
            $group: {
                _id: { $month: "$createdAt" },
                count: { $sum: 1 }
            }
        },
        { $sort: { "_id": 1 } }
    ]);

    return months.map((month, index) => {
        const data = growthData.find(item => item._id === index + 1);
        return {
            label: month,
            count: data ? data.count : 0
        };
    });
};


export const overviewUserService = {
    getStatsOverview,
    getRecentUsers,
    getUserGrowth
}