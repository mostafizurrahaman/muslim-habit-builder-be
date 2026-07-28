import { Types } from "mongoose";
import { UserHabit } from "../../user-habit/user.habit.model";
import { HABIT_STATUS } from "../habit-template/system.habit.constant";
import { HabitTemplate } from "../habit-template/system.habit.model";
import { HabitLog } from "../../habit-logger/habit.logger.model";
import { LOG_STATUS } from "../../habit-logger/habit.logger.constant";

interface GetHabitAnalyticsParams {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
}
 
// Computes the current streak (consecutive days) from a list of completed-date strings.
// Assumes dates are in a lexically-sortable format, e.g. 'YYYY-MM-DD'.
const calculateStreak = (dates: string[]): number => {
    if (!dates.length) return 0;
 
    const uniqueSortedDesc = Array.from(new Set(dates)).sort((a, b) => (a < b ? 1 : -1));
 
    let streak = 1;
    for (let i = 0; i < uniqueSortedDesc.length - 1; i++) {
        const current = new Date(uniqueSortedDesc[i]);
        const prev = new Date(uniqueSortedDesc[i + 1]);
        const diffDays = Math.round((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
 
        if (diffDays === 1) {
            streak++;
        } else {
            break;
        }
    }
 
    return streak;
};
 
const getHabitAnalytics = async ({
    category,
    search,
    page = 1,
    limit = 10,
}: GetHabitAnalyticsParams) => {
    // ── 1. Filter + paginate templates ──────────────────────────
    const templateFilter: any = { isActive: true, status: HABIT_STATUS.PUBLISHED };
 
    if (category && category.toLowerCase() !== 'all') {
        templateFilter.category = { $regex: new RegExp(`^${category}$`, 'i') };
    }
 
    if (search && search.trim()) {
        templateFilter.name = { $regex: new RegExp(search.trim(), 'i') };
    }
 
    // Determine which of the matching templates are "group" templates
    // (i.e. other templates point to them via `group`) — analytics should
    // only show real, leaf habits, so isGroup === true ones are excluded.
    const candidateTemplateIds = await HabitTemplate.find(templateFilter).distinct('_id');
 
    const children = await HabitTemplate.find({
        group: { $in: candidateTemplateIds },
        isActive: true,
        status: HABIT_STATUS.PUBLISHED,
    }).select('group').lean();
 
    const isGroupTemplateIds = new Set(children.map(c => c.group!.toString()));
 
    if (isGroupTemplateIds.size) {
        templateFilter._id = { $nin: Array.from(isGroupTemplateIds) };
    }
 
    const totalItems = await HabitTemplate.countDocuments(templateFilter);
    const totalPages = Math.ceil(totalItems / limit);
 
    const templates = await HabitTemplate.find(templateFilter)
        .select('_id name category')
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
 
    if (!templates.length) {
        return {
            meta: { page: Number(page), limit: Number(limit), total: totalItems, totalPages },
            data: [],
        };
    }
 
    const templateIds = templates.map(t => t._id);
 
    // ── 2. Every UserHabit instance for these templates ────────
    // (a template can have multiple instances per user — e.g. Adhkar after prayer
    //  creates one instance per obligatory prayer — so we track per-instance and
    //  roll up to distinct users per template).
    const userHabits = await UserHabit.find({ template: { $in: templateIds } })
        .select('_id user template')
        .lean();
 
    const instanceIdsByTemplate = new Map<string, Types.ObjectId[]>();
    const usersByTemplate = new Map<string, Set<string>>();
 
    for (const uh of userHabits) {
        const templateKey = uh.template!.toString();
 
        if (!instanceIdsByTemplate.has(templateKey)) instanceIdsByTemplate.set(templateKey, []);
        instanceIdsByTemplate.get(templateKey)!.push(uh._id);
 
        if (!usersByTemplate.has(templateKey)) usersByTemplate.set(templateKey, new Set());
        usersByTemplate.get(templateKey)!.add(uh.user.toString());
    }
 
    const allInstanceIds = userHabits.map(uh => uh._id);
 
    // ── 3. Logs for those instances ─────────────────────────────
    const logs = allInstanceIds.length
        ? await HabitLog.find({ userHabit: { $in: allInstanceIds } })
            .select('userHabit status date')
            .lean()
        : [];
 
    const logsByInstance = new Map<
        string,
        { total: number; completed: number; completedDates: string[] }
    >();
 
    for (const log of logs) {
        const key = log.userHabit.toString();
        if (!logsByInstance.has(key)) {
            logsByInstance.set(key, { total: 0, completed: 0, completedDates: [] });
        }
        const entry = logsByInstance.get(key)!;
        entry.total += 1;
 
        if (log.status === LOG_STATUS.COMPLETED) {
            entry.completed += 1;
            entry.completedDates.push(log.date);
        }
    }
 
    // ── 4. Aggregate per template ────────────────────────────────
    const data = templates.map(t => {
        const templateKey = t._id.toString();
        const instanceIds = instanceIdsByTemplate.get(templateKey) ?? [];
        const totalUsers = usersByTemplate.get(templateKey)?.size ?? 0;
 
        let totalLogs = 0;
        let completedLogs = 0;
        const streaks: number[] = [];
 
        for (const instanceId of instanceIds) {
            const entry = logsByInstance.get(instanceId.toString());
            if (!entry) continue;
 
            totalLogs += entry.total;
            completedLogs += entry.completed;
            streaks.push(calculateStreak(entry.completedDates));
        }
 
        const completionRate = totalLogs > 0
            ? Number(((completedLogs / totalLogs) * 100).toFixed(1))
            : 0;
 
        const avgStreakDays = streaks.length
            ? Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length)
            : 0;
 
        return {
            _id: t._id,
            name: t.name,
            category: t.category,
            totalUsers,
            completionRate,
            avgStreakDays,
            totalCompletions: completedLogs,
        };
    });
 
    return {
        meta: {
            page: Number(page),
            limit: Number(limit),
            total: totalItems,
            totalPages,
        },
        data,
    };
};

export const analyticService = {
    getHabitAnalytics,
}