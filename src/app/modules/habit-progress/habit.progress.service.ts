import moment from "moment-timezone";
import { HabitLog } from "../habit-logger/habit.logger.model";
import { UserHabit } from "../user-habit/user.habit.model";
import { buildDateBasedOnTimeZone } from "../user-habit/user.habit.utils";
import { IUser } from "../user/user.interface";
import { Types } from "mongoose";
import { LOG_STATUS } from "../habit-logger/habit.logger.constant";
import { BadRequestError, NotFoundError } from "../../errors/request/apiError";



const isHabitScheduledOnDate = (habit: any, targetDateStr: string): boolean => {
    const frequency = habit?.frequency;
    if (!frequency || !frequency.type) return true;

    switch (frequency.type) {
        case 'Daily':
            return true;
        case 'Weekly': {
            if (!frequency.selectedDays?.length) return false;
            const dayName = moment(targetDateStr, 'YYYY-MM-DD').format('ddd').toLowerCase();
            return frequency.selectedDays.map((d: string) => d.toLowerCase()).includes(dayName);
        }
        case 'Every_N_Days': {
            if (!frequency.everyNDays) return false;
            const start = moment(habit.startDate).startOf('day');
            const target = moment(targetDateStr, 'YYYY-MM-DD').startOf('day');
            const diffDays = target.diff(start, 'days');
            return diffDays >= 0 && diffDays % frequency.everyNDays === 0;
        }
        default:
            return true;
    }
};

const dedupeActiveHabits = (habits: any[]): any[] => {
    const seenTemplateKeys = new Set<string>();
    return habits.filter((h) => {
        const templateId = h.template?._id?.toString() ?? h.template?.toString();
        if (!templateId) return true;
        const prayerKey = (h.connectedPrayer ?? '').trim().toLowerCase();
        const key = `${templateId}_${prayerKey}`;
        if (seenTemplateKeys.has(key)) return false;
        seenTemplateKeys.add(key);
        return true;
    });
};

// get Combined Progress and Analytics (For Future Use - Master Endpoint For All Data In One Go)

const getCombinedProgressAndAnalytics = async (
    user: IUser, 
    query: { year?: string; month?: string; category?: string; analyticsView?: string; date?: string }
) => {
    try {
        const userId = user._id;
        const { category = 'all', analyticsView = 'week' } = query;
        const userTimezone = (user.timezone as string) || 'UTC';

        // User Registration Date Tracking (Format: 'YYYY-MM-DD')
        const userRegisterDateStr = moment.tz(user.createdAt, userTimezone).format('YYYY-MM-DD');

        const currentDeviceTodayStr = buildDateBasedOnTimeZone(userTimezone);
        const currentDeviceMoment = moment(currentDeviceTodayStr, 'YYYY-MM-DD');

        const anchorDate = query.date && moment(query.date, 'YYYY-MM-DD').isValid() ? moment(query.date, 'YYYY-MM-DD') : null;

        const year = query.year ? query.year : (anchorDate ? anchorDate.format('YYYY') : currentDeviceMoment.format('YYYY'));
        const month = query.month ? String(query.month).padStart(2, '0') : (anchorDate ? anchorDate.format('MM') : currentDeviceMoment.format('MM'));

        const targetMonthPrefix = `${year}-${month}`;
        const todayStr = currentDeviceTodayStr;
        const referenceMoment = moment(todayStr, 'YYYY-MM-DD');

        const normalizeCategory = (catStr: string) => {
            const lower = (catStr || '').toLowerCase().trim();
            if (lower === 'prayer') return 'Prayer';
            if (lower === 'quran' || lower === "qur'an") return 'Quran';
            if (lower === 'dhikr' || lower === 'adhkar') return 'Dhikr';
            if (lower === 'deeds') return 'Deeds';
            return catStr;
        };

        const targetCategoryNormalized = normalizeCategory(category);

        // ─────────────────────────────────────────────────────────
        // SCENARIO B: SPECIFIC CATEGORY TAB SELECTED
        // ─────────────────────────────────────────────────────────
        if (targetCategoryNormalized !== 'all' && targetCategoryNormalized !== '') {
            const targetedCategoryHabits = await UserHabit.find({
                user: userId,
                isActive: true,
                category: { $regex: `^${targetCategoryNormalized}$`, $options: 'i' }
            })
            .select('_id name template connectedPrayer')
            .populate('template', 'name')
            .lean();

            const uniqueCategoryHabits = dedupeActiveHabits(targetedCategoryHabits);

            return {
                viewMode: 'CATEGORY_HABITS',
                categoryName: targetCategoryNormalized,
                habits: uniqueCategoryHabits.map((h: any) => ({
                    _id: h._id,
                    name: h.name ?? h.template?.name ?? null,
                })),
            };
        }

        // ─────────────────────────────────────────────────────────
        // SCENARIO A: 'ALL' TAB SELECTED
        // ─────────────────────────────────────────────────────────
        const rawActiveHabits = await UserHabit.find({ user: userId, isActive: true }).lean();
        const activeHabits = dedupeActiveHabits(rawActiveHabits).map((h: any) => {
            const createdStr = moment.tz(h.createdAt ?? user.createdAt, userTimezone).format('YYYY-MM-DD');
            const startStr = h.startDate ? moment.tz(h.startDate, userTimezone).format('YYYY-MM-DD') : createdStr;
            return {
                ...h,
                _idStr: h._id.toString(),
                _activeFromStr: startStr < createdStr ? startStr : createdStr,
            };
        });
        const activeHabitIdSet = new Set(activeHabits.map((h: any) => h._idStr));

        const groupCompletedByDate = (logs: any[]): Record<string, Set<string>> =>
            logs.reduce((acc: Record<string, Set<string>>, log: any) => {
                const habitIdStr = log.userHabit?.toString();
                if (!acc[log.date]) acc[log.date] = new Set();
                if (log.status === 'Completed' && habitIdStr && activeHabitIdSet.has(habitIdStr)) {
                    acc[log.date].add(habitIdStr);
                }
                return acc;
            }, {});

        const isParentCompletedOnDate = (h: any, completedSet: Set<string>): boolean =>
            completedSet.has(h._idStr);

        const getDayProgressStats = (dateStr: string, completedSet: Set<string>) => {
            const scheduled = activeHabits.filter(
                (h: any) => (h._activeFromStr <= dateStr || completedSet.has(h._idStr)) && isHabitScheduledOnDate(h, dateStr),
            );
            const completedCount = scheduled.filter((h: any) => isParentCompletedOnDate(h, completedSet)).length;
            const ratio = scheduled.length > 0 ? Math.min(100, Math.round((completedCount / scheduled.length) * 100)) : 0;
            return { scheduled, scheduledCount: scheduled.length, completedCount, ratio };
        };

        const getLabelByRatio = (r: number, dateStr?: string) => {
            if (r >= 60) return 'Good';
            if (r >= 20) return 'Partial';
            if (dateStr && dateStr === todayStr) return '';
            return 'Missed';
        };

        // MODULE A: TODAY'S PROGRESS OVERVIEW
        const todayLogs = await HabitLog.find({ user: userId, date: todayStr, status: 'Completed' }).lean();
        const todayCompletedSet = groupCompletedByDate(todayLogs)[todayStr] ?? new Set<string>();
        const todayStats = getDayProgressStats(todayStr, todayCompletedSet);

        const categoryStats = {
            Prayer: { total: 0, completed: 0 },
            Quran: { total: 0, completed: 0 },
            Dhikr: { total: 0, completed: 0 },
            Deeds: { total: 0, completed: 0 },
        };

        todayStats.scheduled.forEach((h: any) => {
            const cat = normalizeCategory(h.category);
            if (categoryStats[cat as keyof typeof categoryStats]) {
                categoryStats[cat as keyof typeof categoryStats].total += 1;
                if (isParentCompletedOnDate(h, todayCompletedSet)) {
                    categoryStats[cat as keyof typeof categoryStats].completed += 1;
                }
            }
        });

        const getRatio = (completed: number, total: number) => total > 0 ? Math.round((completed / total) * 100) : 0;

        const overviewCard = {
            overallPercentage: todayStats.ratio,
            counters: {
                completed: todayStats.completedCount,
                missed: Math.max(0, todayStats.scheduledCount - todayStats.completedCount),
            },
            categories: {
                Prayer: getRatio(categoryStats.Prayer.completed, categoryStats.Prayer.total),
                Quran: getRatio(categoryStats.Quran.completed, categoryStats.Quran.total),
                Adhkar: getRatio(categoryStats.Dhikr.completed, categoryStats.Dhikr.total),
                Deeds: getRatio(categoryStats.Deeds.completed, categoryStats.Deeds.total),
            },
        };

        // MODULE B: MONTHLY CALENDAR GRID STATUS
        const monthlyLogs = await HabitLog.find({
            user: userId,
            date: { $regex: `^${targetMonthPrefix}` },
            status: 'Completed',
        }).lean();
        const dayGrouping = groupCompletedByDate(monthlyLogs);

        const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const calendarGrid = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const currentFormattedDate = `${targetMonthPrefix}-${String(d).padStart(2, '0')}`;
            if (currentFormattedDate > todayStr || currentFormattedDate < userRegisterDateStr) {
                calendarGrid.push({
                    date: currentFormattedDate,
                    day: d,
                    completionRatio: 0,
                    status: '',
                });
                continue;
            }

            const dayStats = getDayProgressStats(currentFormattedDate, dayGrouping[currentFormattedDate] ?? new Set());
            calendarGrid.push({
                date: currentFormattedDate,
                day: d,
                completionRatio: dayStats.ratio,
                status: getLabelByRatio(dayStats.ratio, currentFormattedDate),
            });
        }

        // MODULE C: LOWER SECTION ANALYTICS GRAPHS DATA
        let analyticsGraphData: any = {};

        // Sub-Case 1: Week Data Block
        if (analyticsView === 'week') {
            const currentYearMonth = referenceMoment.format('YYYY-MM');
            const anchorMoment = anchorDate
                ?? (query.year && query.month && `${year}-${month}` !== currentYearMonth
                    ? moment(`${year}-${month}-01`, 'YYYY-MM-DD')
                    : referenceMoment);

            const startOfWeek = anchorMoment.clone().startOf('week');
            const endOfWeek = startOfWeek.clone().add(6, 'days');
            const startOfWeekStr = startOfWeek.format('YYYY-MM-DD');
            const endOfWeekStr = endOfWeek.format('YYYY-MM-DD');

            const weekLogs = await HabitLog.find({
                user: userId,
                date: { $gte: startOfWeekStr, $lte: endOfWeekStr },
                status: 'Completed',
            }).lean();
            const weekDayCompletedMap = groupCompletedByDate(weekLogs);

            const weeklyMetrics = [];
            let maxCompleted = 0, bestDay = 'N/A';

            for (let i = 0; i < 7; i++) {
                const currentDay = startOfWeek.clone().add(i, 'days');
                const dayStr = currentDay.format('YYYY-MM-DD');
                const dayShortName = currentDay.format('ddd');

                if (dayStr > todayStr || dayStr < userRegisterDateStr) {
                    weeklyMetrics.push({
                        label: dayShortName,
                        date: dayStr,
                        habitsCompletedCount: 0,
                        completionRatio: 0,
                        status: '',
                    });
                    continue;
                }

                const dayStats = getDayProgressStats(dayStr, weekDayCompletedMap[dayStr] ?? new Set());
                if (dayStats.completedCount > maxCompleted) {
                    maxCompleted = dayStats.completedCount;
                    bestDay = dayShortName;
                }

                weeklyMetrics.push({
                    label: dayShortName,
                    date: dayStr,
                    habitsCompletedCount: dayStats.completedCount,
                    completionRatio: dayStats.ratio,
                    status: getLabelByRatio(dayStats.ratio, dayStr),
                });
            }
            const weeklyRatioSum = weeklyMetrics.reduce((sum, m) => sum + m.completionRatio, 0);
            analyticsGraphData = {
                viewType: 'week',
                range: {
                    startDate: startOfWeekStr,
                    endDate: endOfWeekStr,
                    displayLabel: `${startOfWeek.format('D MMM')} - ${endOfWeek.format('D MMM YYYY')}`,
                },
                bestDisplayLabel: `Best Day: ${bestDay}`,
                completionRatio: Number((weeklyRatioSum / 7).toFixed(2)),
                metrics: weeklyMetrics,
            };
        }

        // Sub-Case 2: Month Data Block (task-wise across eligible days)
        if (analyticsView === 'month') {
            const currentYearStr = year;
            const monthlyMetrics = [];
            let maxMonthlyRatio = 0, bestMonth = 'N/A';
            const currentMonthStartStr = referenceMoment.clone().startOf('month').format('YYYY-MM-DD');
            const userRegisterMonthStartStr = moment(userRegisterDateStr).startOf('month').format('YYYY-MM-DD');

            const yearCompletedLogs = await HabitLog.find({
                user: userId,
                date: { $regex: `^${currentYearStr}` },
                status: 'Completed',
            }).lean();
            const yearCompletedMap = groupCompletedByDate(yearCompletedLogs);

            for (let m = 1; m <= 12; m++) {
                const prefix = `${currentYearStr}-${String(m).padStart(2, '0')}`;
                const firstDayOfMonthStr = `${prefix}-01`;
                const monthShortLabel = moment().month(m - 1).format('MMM');

                if (firstDayOfMonthStr > currentMonthStartStr || firstDayOfMonthStr < userRegisterMonthStartStr) {
                    monthlyMetrics.push({
                        label: monthShortLabel,
                        daysCompletedCount: 0,
                        completionRatio: 0,
                        status: '',
                    });
                    continue;
                }

                const totalDaysInMonth = new Date(parseInt(currentYearStr, 10), m, 0).getDate();
                const lastDayOfMonthStr = `${prefix}-${String(totalDaysInMonth).padStart(2, '0')}`;
                const effectiveMonthStart = firstDayOfMonthStr < userRegisterDateStr ? userRegisterDateStr : firstDayOfMonthStr;
                const effectiveMonthEnd = lastDayOfMonthStr > todayStr ? todayStr : lastDayOfMonthStr;

                let totalDailyRatio = 0;
                let totalDaysWithCompletion = 0;

                const dayIter = moment(effectiveMonthStart, 'YYYY-MM-DD');
                const endIter = moment(effectiveMonthEnd, 'YYYY-MM-DD');
                while (dayIter.isSameOrBefore(endIter)) {
                    const dStr = dayIter.format('YYYY-MM-DD');
                    const dayStats = getDayProgressStats(dStr, yearCompletedMap[dStr] ?? new Set());
                    totalDailyRatio += dayStats.ratio;
                    if (dayStats.completedCount > 0) totalDaysWithCompletion += 1;
                    dayIter.add(1, 'day');
                }

                const mRatio = totalDaysInMonth > 0
                    ? Math.min(100, Number((totalDailyRatio / totalDaysInMonth).toFixed(2)))
                    : 0;

                if (mRatio > maxMonthlyRatio) {
                    maxMonthlyRatio = mRatio;
                    bestMonth = moment().month(m - 1).format('MMMM');
                }

                monthlyMetrics.push({
                    label: monthShortLabel,
                    daysCompletedCount: totalDaysWithCompletion,
                    completionRatio: mRatio,
                    status: getLabelByRatio(mRatio),
                });
            }
            analyticsGraphData = {
                viewType: 'month',
                range: {
                    year: currentYearStr,
                    displayLabel: currentYearStr,
                },
                bestDisplayLabel: `Best Month: ${bestMonth}`,
                metrics: monthlyMetrics,
            };
        }

        // Sub-Case 3: Year Data Block (task-wise across eligible days)
        if (analyticsView === 'year') {
            const activeYear = parseInt(year, 10);
            const yearlyMetrics = [];
            let maxYearlyRatio = 0, bestYear = 'N/A';
            const baseStartYear = activeYear - 3;
            const userRegisterYear = moment(userRegisterDateStr).year();

            for (let offset = 0; offset < 4; offset++) {
                const queryYear = baseStartYear + offset;
                const yearStringLabel = String(queryYear);

                if (queryYear > referenceMoment.year() || queryYear < userRegisterYear) {
                    yearlyMetrics.push({
                        label: yearStringLabel,
                        daysCompletedCount: 0,
                        completionRatio: 0,
                        status: '',
                    });
                    continue;
                }

                const yearlyCompletedLogs = await HabitLog.find({
                    user: userId,
                    date: { $regex: `^${queryYear}` },
                    status: 'Completed',
                }).lean();
                const yearlyCompletedMap = groupCompletedByDate(yearlyCompletedLogs);

                const firstDayOfYearStr = `${queryYear}-01-01`;
                const lastDayOfYearStr = `${queryYear}-12-31`;
                const effectiveYearStart = firstDayOfYearStr < userRegisterDateStr ? userRegisterDateStr : firstDayOfYearStr;
                const effectiveYearEnd = lastDayOfYearStr > todayStr ? todayStr : lastDayOfYearStr;

                let totalCompletedTasks = 0;
                let totalScheduledTasks = 0;
                let uniqueCompletedDays = 0;

                const dayIter = moment(effectiveYearStart, 'YYYY-MM-DD');
                const endIter = moment(effectiveYearEnd, 'YYYY-MM-DD');
                while (dayIter.isSameOrBefore(endIter)) {
                    const dStr = dayIter.format('YYYY-MM-DD');
                    const dayStats = getDayProgressStats(dStr, yearlyCompletedMap[dStr] ?? new Set());
                    totalCompletedTasks += dayStats.completedCount;
                    totalScheduledTasks += dayStats.scheduledCount;
                    if (dayStats.completedCount > 0) uniqueCompletedDays += 1;
                    dayIter.add(1, 'day');
                }

                const yRatio = totalScheduledTasks > 0
                    ? Math.min(100, Math.round((totalCompletedTasks / totalScheduledTasks) * 100))
                    : 0;

                if (yRatio > maxYearlyRatio) {
                    maxYearlyRatio = yRatio;
                    bestYear = yearStringLabel;
                }

                yearlyMetrics.push({
                    label: yearStringLabel,
                    daysCompletedCount: uniqueCompletedDays,
                    completionRatio: yRatio,
                    status: getLabelByRatio(yRatio),
                });
            }
            analyticsGraphData = {
                viewType: 'year',
                range: {
                    startYear: baseStartYear,
                    endYear: baseStartYear + 3,
                    displayLabel: `${baseStartYear} - ${baseStartYear + 3}`,
                },
                bestDisplayLabel: `Best Year: ${bestYear}`,
                metrics: yearlyMetrics,
            };
        }

        return {
            viewMode: 'GLOBAL_OVERVIEW',
            progressOverview: overviewCard,
            calendarHistoryGrid: calendarGrid,
            analyticsCharts: analyticsGraphData //
        };

    } catch (error: any) {
        throw new Error(`Failed to process master progress panel dataset matrix: ${error.message}`);
    }
};



// get individual habit analytics
const getIndividualHabitAnalytics = async (
    user: IUser, 
    habitId: string, 
    query: { year?: string; month?: string }
) => {
    try {
        if (!Types.ObjectId.isValid(habitId)) {
            throw new BadRequestError('Invalid habit ID format');
        }

        const userId = user._id;

        const userTimezone = (user.timezone as string) || 'UTC';

        // 🚀 User account creation timeline reference
        const userRegisterDateStr = moment.tz(user.createdAt, userTimezone).format('YYYY-MM-DD');

        // Current real-time layout snapshot reference benchmarks
        const currentDeviceTodayStr = buildDateBasedOnTimeZone(userTimezone);
        const currentDeviceMoment = moment(currentDeviceTodayStr, 'YYYY-MM-DD');

        const year = query.year ? String(query.year) : currentDeviceMoment.format('YYYY');
        const monthNum = query.month ? Number(query.month) : Number(currentDeviceMoment.format('MM'));
        if (!/^\d{4}$/.test(year) || !Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
            throw new BadRequestError('Invalid year or month query parameter');
        }
        const month = String(monthNum).padStart(2, '0');

        const targetMonthPrefix = `${year}-${month}`;
        const todayStr = currentDeviceTodayStr;

        // Verify habit resource configuration constraints existence first
        const trackingHabit = await UserHabit.findOne({ _id: habitId, user: userId })
            .populate('template', 'name')
            .lean();
        if (!trackingHabit) {
            throw new NotFoundError('Requested user tracking habit not found.');
        }

        const resolvedHabitName = trackingHabit.name ?? (trackingHabit.template as any)?.name ?? null;

        // Determine effective tracking start date from progressRestartedAt -> createdAt -> startDate -> userRegisterDateStr
        const rawHabitStart =
            trackingHabit.progressRestartedAt ??
            (trackingHabit as any).createdAt ??
            trackingHabit.startDate ??
            user.createdAt;
        const habitStartDateStr = moment.tz(rawHabitStart, userTimezone).format('YYYY-MM-DD');
        const effectiveStartDateStr =
            habitStartDateStr > todayStr
                ? todayStr
                : habitStartDateStr < userRegisterDateStr
                ? userRegisterDateStr
                : habitStartDateStr;

        // ─────────────────────────────────────────────────────────
        // 📊 MODULE 2: SPECIFIC SINGLE HABIT MONTHLY CALENDAR GRID
        // ─────────────────────────────────────────────────────────
        const monthlyHabitLogs = await HabitLog.find({
            user: userId,
            userHabit: habitId,
            date: { $regex: `^${targetMonthPrefix}` }
        }).lean();

        const logStatusLookupMap = new Map<string, any>(monthlyHabitLogs.map((l: any) => [l.date, l.status]));

        const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate(); 
        const calendarHistoryGrid = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const currentFormattedDate = `${targetMonthPrefix}-${String(d).padStart(2, '0')}`;
            const dbLoggedStatus = logStatusLookupMap.get(currentFormattedDate);

            let calculatedStatus = 'Missed';

            if (currentFormattedDate > todayStr || currentFormattedDate < userRegisterDateStr) {
                calculatedStatus = '';
            } else if (dbLoggedStatus === 'Completed' || dbLoggedStatus === 'Missed') {
                calculatedStatus = dbLoggedStatus;
            } else if (currentFormattedDate === todayStr) {
                calculatedStatus = ''; // Today, no valid log yet
            } else {
                calculatedStatus = 'Missed'; // Past date, no valid log = Missed
            }

            calendarHistoryGrid.push({
                date: currentFormattedDate,
                day: d,
                status: calculatedStatus // Exact match field string 'Completed' | 'Missed' | ''
            });
        }

        // ─────────────────────────────────────────────────────────
        // 📊 MODULE 3: WEEKLY BREAKDOWN ANALYTICS CARD (Current Week)
        // ─────────────────────────────────────────────────────────
        const activeTodayMoment = moment(todayStr, 'YYYY-MM-DD');
        const weekStartMoment = activeTodayMoment.clone().startOf('week');
        const weekStartStr = weekStartMoment.format('YYYY-MM-DD');

        const weeklyHabitLogs = await HabitLog.find({
            user: userId,
            userHabit: habitId,
            date: {
                $gte: weekStartStr,
                $lte: todayStr,
            },
        }).sort({ date: 1 }).lean();

        let totalCompletedCount = 0;
        let totalMissedCount = 0;

        // Weekday tracking dictionaries initialization setup matrix
        const weekdayFrequencyWeightMap: Record<string, { completed: number; total: number }> = {
            'Monday': { completed: 0, total: 0 },
            'Tuesday': { completed: 0, total: 0 },
            'Wednesday': { completed: 0, total: 0 },
            'Thursday': { completed: 0, total: 0 },
            'Friday': { completed: 0, total: 0 },
            'Saturday': { completed: 0, total: 0 },
            'Sunday': { completed: 0, total: 0 }
        };

        // Populate database execution log metrics map for current week
        const logsDateIndexedMap = new Map<string, any>(weeklyHabitLogs.map((l: any) => [l.date, l.status]));

        // 📊 MODULE 1: OVERALL HABIT COMPLETION PERCENTAGE (for the requested month)
        const completedInMonthCount = calendarHistoryGrid.filter((d) => d.status === 'Completed').length;
        const overallCompletionRatio = daysInMonth > 0
            ? Number(((completedInMonthCount / daysInMonth) * 100).toFixed(2))
            : 0;

        // 🚀 CALCULATE WEEKLY METRICS & MAX STREAK WITHIN CURRENT WEEK
        let currentMaxStreak = 0;
        let runningStreakCounter = 0;

        for (let i = 0; i < 7; i++) {
            const currentWeekDay = weekStartMoment.clone().add(i, 'days');
            const loopDateKeyStr = currentWeekDay.format('YYYY-MM-DD');
            if (loopDateKeyStr > todayStr) break;

            const dayNameStr = currentWeekDay.format('dddd');
            const recordedStatus = logsDateIndexedMap.get(loopDateKeyStr);
            const isScheduled = isHabitScheduledOnDate(trackingHabit, loopDateKeyStr);

            if (recordedStatus === 'Completed') {
                totalCompletedCount++;
                runningStreakCounter++;
                if (runningStreakCounter > currentMaxStreak) {
                    currentMaxStreak = runningStreakCounter;
                }
                if (weekdayFrequencyWeightMap[dayNameStr]) {
                    weekdayFrequencyWeightMap[dayNameStr].completed += 1;
                    weekdayFrequencyWeightMap[dayNameStr].total += 1;
                }
            } else if (
                loopDateKeyStr >= effectiveStartDateStr &&
                isScheduled &&
                (loopDateKeyStr < todayStr || recordedStatus === 'Skipped' || recordedStatus === 'Missed')
            ) {
                totalMissedCount++;
                runningStreakCounter = 0;
                if (weekdayFrequencyWeightMap[dayNameStr]) {
                    weekdayFrequencyWeightMap[dayNameStr].total += 1;
                }
            }
        }

        const weeklyCompletionProgress = Number(((totalCompletedCount / 7) * 100).toFixed(2));

        // 🚀 COMPUTE HIGHEST AND LOWEST INTERACTION DAY LABELS (Best & Quietest Days)
        let maxDayRatio = -1;
        let minDayRatio = 101;
        
        let bestDaysArray: string[] = [];
        let quietestDaysArray: string[] = [];

        Object.keys(weekdayFrequencyWeightMap).forEach((day) => {
            const metrics = weekdayFrequencyWeightMap[day];
            if (metrics.total > 0) {
                const calculatedRatio = Math.round((metrics.completed / metrics.total) * 100);

                // Evaluation engine checking for best days parameters matching rules
                if (calculatedRatio > maxDayRatio) {
                    maxDayRatio = calculatedRatio;
                    bestDaysArray = [day.substring(0, 3)]; // Slice down to standard short string token e.g., 'Mon'
                } else if (calculatedRatio === maxDayRatio && maxDayRatio > 0) {
                    bestDaysArray.push(day.substring(0, 3));
                }

                // Evaluation engine checking for quietest days mapping constraints
                if (calculatedRatio < minDayRatio) {
                    minDayRatio = calculatedRatio;
                    quietestDaysArray = [day.substring(0, 3)]; // Short formatting text code format match e.g., 'Sun'
                } else if (calculatedRatio === minDayRatio) {
                    quietestDaysArray.push(day.substring(0, 3));
                }
            }
        });

        // Safe operational fallbacks logic criteria adjustments
        const finalBestDisplayString = bestDaysArray.length > 0 && maxDayRatio > 0 ? bestDaysArray.join(', ') : 'N/A'; //
        const finalQuietestDisplayString = quietestDaysArray.length > 0 ? quietestDaysArray.join(', ') : 'N/A'; //

        // Combined payload response structures compile match
        return {
            habitId: trackingHabit._id,
            habitName: resolvedHabitName,
            percentage: overallCompletionRatio,
            calendarHistory: calendarHistoryGrid, // Grid status: 'Completed' | 'Missed' | ''
            breakdownCard: {
                weeklyCompletionProgress,
                completedDaysCount: totalCompletedCount, //
                missedDaysCount: totalMissedCount,       //
                bestStreakDays: currentMaxStreak,        // Continuous counting index indicator
                bestDaysDisplay: finalBestDisplayString,      // Explicit short keys format context string
                quietestDaysDisplay: finalQuietestDisplayString // Explicit short keys format context string
            }
        };

    } catch (error: any) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) {
            throw error;
        }
        throw new Error(`Failed to compile structured individual habit analysis metrics schema: ${error.message}`);
    }
};


const restartProgress = async (user: IUser, habitId: string) => {
  try {
    const todayStr = buildDateBasedOnTimeZone((user.timezone as string) || 'UTC');
   
    const habitLog = await HabitLog.findOne({
      user: user._id, 
      userHabit: new Types.ObjectId(habitId),
      date: todayStr
    });

    if (!habitLog) {
      throw new NotFoundError("No habit log found for today.");
    }

    if (habitLog.status === LOG_STATUS.COMPLETED) {
      habitLog.status = LOG_STATUS.PENDING;
      habitLog.completedAt = null; 
      
     
      await habitLog.save();
    }

    return habitLog;
  } catch (error) {
    throw error;
  }
};

export const habitProgressService = {
    getCombinedProgressAndAnalytics,
    getIndividualHabitAnalytics,
    restartProgress
}











// /*

// import { Types } from 'mongoose';
// import { UserHabit, IUserHabit } from './userHabit.model'; // adjust the path as needed
// import { HabitLog } from './habitLog.model';               // adjust the path as needed
// import { 
//   OverallProgress, 
//   CategoryHabit, 
//   DayProgress, 
//   WeeklyBarData,
//   HabitCategory 
// } from '@/types/progress.types';

// // Helper: generate the days of a month
// const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

// // Helper: extract the day name from a date (Mon, Tue...)
// const getDayName = (date: Date): string => {
//   return date.toLocaleDateString('en-US', { weekday: 'short' });
// };

// export class ProgressService {
//   /**
//    * Function to calculate overall progress (All Tab)
//    */
//   static async getOverallProgress(userId: Types.ObjectId, year: number, month: number): Promise<OverallProgress> {
//     const habits = await UserHabit.find({ userId, isActive: true });
//     const startDate = new Date(year, month, 1);
//     const endDate = new Date(year, month, getDaysInMonth(year, month), 23, 59, 59);
    
//     const logs = await HabitLog.find({
//       userId,
//       date: { $gte: startDate, $lte: endDate }
//     });

//     const calendarData = this.buildOverallCalendar(logs, habits, year, month);
    
//     const totalDays = getDaysInMonth(year, month);
//     const today = new Date().getDate();
//     const passedDays = today <= totalDays ? today : totalDays;

//     // Calculate total completed and missed items from the calendar
//     const completedTotal = calendarData.filter(d => d.status === 'completed').length;
//     const missedTotal = calendarData.filter(d => d.status === 'missed').length;
//     const percentage = passedDays > 0 ? Math.round((completedTotal / passedDays) * 100) : 0;

//     // Category-wise breakdown
//     const categoryBreakdown = await this.getCategoryBreakdown(userId, year, month);

//     return {
//       percentage,
//       completedTotal,
//       missedTotal,
//       categoryBreakdown,
//       calendarData
//     };
//   }

//   /**
//    * Progress for habits under a specific category (Prayer, Quran Tab)
//    */
//   static async getCategoryHabits(userId: Types.ObjectId, category: HabitCategory, year: number, month: number): Promise<CategoryHabit[]> {
//     const habits = await UserHabit.find({ userId, category, isActive: true });
    
//     return Promise.all(habits.map(async (habit) => {
//       return this.calculateSingleHabitProgress(habit, year, month);
//     }));
//   }

//   // --- Private Helper Functions ---

//   private static async calculateSingleHabitProgress(habit: IUserHabit, year: number, month: number): Promise<CategoryHabit> {
//     const startDate = new Date(year, month, 1);
//     const endDate = new Date(year, month, getDaysInMonth(year, month), 23, 59, 59);

//     const logs = await HabitLog.find({
//       userHabitId: habit._id,
//       date: { $gte: startDate, $lte: endDate }
//     });

//     const totalDays = getDaysInMonth(year, month);
//     const today = new Date().getDate();
//     const passedDays = today <= totalDays ? today : totalDays;

//     const completedDays = logs.filter(l => l.status === 'Completed').length;
//     const missedDays = logs.filter(l => l.status === 'Skipped').length; // or 'Missed' based on your logic
//     const percentage = passedDays > 0 ? Math.round((completedDays / passedDays) * 100) : 0;

//     const calendarData = this.buildHabitCalendar(logs, year, month);
//     const weeklyData = this.calculateWeeklyData(logs, year, month);
    
//     // Streak and best/quietest day calculation (simple version)
//     const { bestStreak, bestDays, quietestDays } = this.calculateStreaksAndDays(calendarData, year, month);
    
//     // Completion for this week
//     const completionThisWeek = this.calculateCurrentWeekPercentage(logs);

//     return {
//       id: habit._id.toString(),
//       title: habit.name,
//       category: habit.category as HabitCategory,
//       percentage,
//       completedDays,
//       missedDays,
//       bestStreak,
//       bestDays,
//       quietestDays,
//       weeklyData,
//       calendarData,
//       completionThisWeek
//     };
//   }

//   private static buildOverallCalendar(logs: any[], habits: IUserHabit[], year: number, month: number): DayProgress[] {
//     const totalDays = getDaysInMonth(year, month);
//     const today = new Date();
//     const calendar: DayProgress[] = [];
//     const totalHabitsCount = habits.length;

//     for (let i = 1; i <= totalDays; i++) {
//       const currentDate = new Date(year, month, i);
      
//       // Future day
//       if (currentDate > today) {
//         calendar.push({ date: i, month, year, status: 'future' });
//         continue;
//       }

//       // Filter logs for today or earlier days
//       const dayLogs = logs.filter(l => {
//         const logDate = new Date(l.date);
//         return logDate.getDate() === i && logDate.getMonth() === month && logDate.getFullYear() === year;
//       });

//       const completedCount = dayLogs.filter(l => l.status === 'Completed').length;

//       if (completedCount === totalHabitsCount && totalHabitsCount > 0) {
//         calendar.push({ date: i, month, year, status: 'completed', completedCount, totalCount: totalHabitsCount });
//       } else if (completedCount > 0) {
//         calendar.push({ date: i, month, year, status: 'partial', completedCount, totalCount: totalHabitsCount });
//       } else if (dayLogs.length > 0 || currentDate < today) {
//         calendar.push({ date: i, month, year, status: 'missed', completedCount: 0, totalCount: totalHabitsCount });
//       } else {
//         calendar.push({ date: i, month, year, status: 'empty' });
//       }
//     }
//     return calendar;
//   }

//   private static buildHabitCalendar(logs: any[], year: number, month: number): DayProgress[] {
//     const totalDays = getDaysInMonth(year, month);
//     const today = new Date();
//     const calendar: DayProgress[] = [];

//     for (let i = 1; i <= totalDays; i++) {
//       const currentDate = new Date(year, month, i);
//       if (currentDate > today) {
//         calendar.push({ date: i, month, year, status: 'future' });
//         continue;
//       }

//       const log = logs.find(l => {
//         const logDate = new Date(l.date);
//         return logDate.getDate() === i && logDate.getMonth() === month && logDate.getFullYear() === year;
//       });

//       if (log?.status === 'Completed') {
//         calendar.push({ date: i, month, year, status: 'completed', completedCount: 1, totalCount: 1 });
//       } else if (log?.status === 'Skipped' || (currentDate < today && !log)) {
//         calendar.push({ date: i, month, year, status: 'missed', completedCount: 0, totalCount: 1 });
//       } else {
//         calendar.push({ date: i, month, year, status: 'empty' });
//       }
//     }
//     return calendar;
//   }

//   private static calculateWeeklyData(logs: any[], year: number, month: number): WeeklyBarData[] {
//     // Create a 7-day week format
//     const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
//     const totalDays = getDaysInMonth(year, month);
//     const today = new Date().getDate();
    
//     // Day-wise completion mapping
//     const dayWiseCompletion: Record<string, { completed: number, total: number }> = {};

//     for (let i = 1; i <= (today <= totalDays ? today : totalDays); i++) {
//       const date = new Date(year, month, i);
//       const dayName = weekDays[date.getDay()]; // 'Mon', 'Tue' etc.
      
//       if (!dayWiseCompletion[dayName]) dayWiseCompletion[dayName] = { completed: 0, total: 0 };
      
//       const isCompleted = logs.some(l => {
//         const logDate = new Date(l.date);
//         return logDate.getDate() === i && l.status === 'Completed';
//       });

//       if (isCompleted) dayWiseCompletion[dayName].completed++;
//       dayWiseCompletion[dayName].total++;
//     }

//     // Return only the days that appear in the month (or keep all days as 0 if you prefer)
//     return weekDays.map(day => ({
//       day,
//       value: dayWiseCompletion[day] && dayWiseCompletion[day].total > 0
//         ? Math.round((dayWiseCompletion[day].completed / dayWiseCompletion[day].total) * 100)
//         : 0
//     })).filter(d => d.value > 0 || true); // true keeps all days visible
//   }

//   private static calculateStreaksAndDays(calendarData: DayProgress[], year: number, month: number) {
//     let bestStreak = 0, currentStreak = 0;
//     const dayStats: Record<string, number> = {};

//     calendarData.forEach(day => {
//       const dateObj = new Date(year, month, day.date);
//       const dayName = getDayName(dateObj);
      
//       if (!dayStats[dayName]) dayStats[dayName] = 0;

//       if (day.status === 'completed') {
//         currentStreak++;
//         bestStreak = Math.max(bestStreak, currentStreak);
//         dayStats[dayName] += 100;
//       } else if (day.status === 'missed') {
//         currentStreak = 0;
//         dayStats[dayName] += 0;
//       } else if (day.status === 'partial') {
//         currentStreak = 0;
//         dayStats[dayName] += 50;
//       }
//     });

//     // Determine the best and quietest days
//     let maxAvg = -1, minAvg = 101;
//     let bestDays: string[] = [], quietestDays: string[] = [];
    
//     const dayCounts: Record<string, number> = {};
//     calendarData.filter(d => d.status !== 'future' && d.status !== 'empty').forEach(d => {
//       const dayName = getDayName(new Date(year, month, d.date));
//       dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
//     });

//     for (const [day, totalScore] of Object.entries(dayStats)) {
//       const count = dayCounts[day] || 1;
//       const avg = totalScore / count;
      
//       if (avg > maxAvg) { maxAvg = avg; bestDays = [day]; }
//       else if (avg === maxAvg) bestDays.push(day);

//       if (avg < minAvg) { minAvg = avg; quietestDays = [day]; }
//       else if (avg === minAvg) quietestDays.push(day);
//     }

//     return { bestStreak, bestDays, quietestDays };
//   }

//   private static calculateCurrentWeekPercentage(logs: any[]): number {
//     const now = new Date();
//     const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
//     const startOfWeek = new Date(now);
//     startOfWeek.setDate(now.getDate() - dayOfWeek);
//     startOfWeek.setHours(0, 0, 0, 0);

//     const weekLogs = logs.filter(l => new Date(l.date) >= startOfWeek);
//     const completedInWeek = weekLogs.filter(l => l.status === 'Completed').length;
    
//     // Count how many days have passed so far (Sunday=1, Monday=2...)
//     const daysPassedThisWeek = dayOfWeek + 1; 
    
//     return daysPassedThisWeek > 0 ? Math.round((completedInWeek / daysPassedThisWeek) * 100) : 0;
//   }

//   private static async getCategoryBreakdown(userId: Types.ObjectId, year: number, month: number) {
//     const categories: HabitCategory[] = ['Prayer', 'Quran', 'Dhikr', 'Deeds'];
//     const breakdown = [];

//     for (const cat of categories) {
//       const habits = await UserHabit.find({ userId, category: cat, isActive: true });
//       const habitIds = habits.map(h => h._id);
      
//       const startDate = new Date(year, month, 1);
//       const endDate = new Date(year, month, getDaysInMonth(year, month), 23, 59, 59);
      
//       const logs = await HabitLog.find({ userHabitId: { $in: habitIds }, date: { $gte: startDate, $lte: endDate } });
      
//       // Simple logic here: total completed logs / total habits * passed days
//       const today = new Date().getDate();
//       const passedDays = today <= getDaysInMonth(year, month) ? today : getDaysInMonth(year, month);
//       const totalPossibleLogs = habits.length * passedDays;
//       const completedLogs = logs.filter(l => l.status === 'Completed').length;
      
//       const percentage = totalPossibleLogs > 0 ? Math.round((completedLogs / totalPossibleLogs) * 100) : 0;
      
//       breakdown.push({ category: cat, percentage });
//     }

//     return breakdown;
//   }
// }

// */