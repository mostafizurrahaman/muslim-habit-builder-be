import moment from 'moment-timezone';

export const buildDateBasedOnTimeZone = (
    timezone: string
): string => {
    return moment.tz(timezone).format('YYYY-MM-DD');
};

/*

const toggleHabit = async (user: IUser, habitId: string, isActive: boolean) => {
    const userId = user._id as Types.ObjectId;
    const date = buildDateBasedOnTimeZone(user.timezone as string);

    // ─────────────────────────────────────────────────────────
    //  DEACTIVATE PATH
    // ─────────────────────────────────────────────────────────
    if (!isActive) {
        const childTemplates = await HabitTemplate.find({
            group: habitId,
            isActive: true,
        }).lean();
        console.log({ childTemplates })
        const isGroup = childTemplates.length > 0;

        // ── Group deactivate ──
        if (isGroup) {
            const activeHabits = await UserHabit.find({
                user: userId,
                template: { $in: childTemplates.map(c => c._id) },
                isActive: true,
            }).select('_id').lean();
            console.log({ activeHabits })
            if (!activeHabits.length) {
                throw new BadRequestError('No active habits found in this group.');
            }

            const habitIds = activeHabits.map(h => h._id);

            await UserHabit.updateMany(
                { _id: { $in: habitIds } },
                { $set: { isActive: false } },
            );

            await HabitLog.updateMany(
                { userHabit: { $in: habitIds }, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );


            await Promise.all(habitIds.map(id => disconnectFromParents(id)));

            console.log({ habitIds })


            const activeChildHabits = await UserHabit.find({
                user: userId,
                parent: { $in: childTemplates.map(c => c._id) },
                isActive: true,
            }).select('_id').lean();

            if (activeChildHabits.length) {
                await UserHabit.updateMany(
                    { _id: { $in: activeChildHabits.map(h => h._id) } },
                    { $set: { isActive: false } }
                );
            }

            return null;
        }

        // ── Single deactivate ──
        const userHabit = await UserHabit.findOne({
            template: habitId,
            user: userId,
            isActive: true,
        });

        if (!userHabit) {
            const customHabit = await UserHabit.findOne({
                _id: habitId,
                user: userId,
                template: null,
            });

            console.log({ customHabit });

            if (!customHabit) {
                throw new BadRequestError('custom habit not found');
            }
            if (!customHabit.isActive) {
                throw new BadRequestError('Habit is already deactivated');
            }
            await HabitLog.findOneAndUpdate(
                { userHabit: customHabit._id, date: String(date), status: LOG_STATUS.PENDING },
                { $set: { status: LOG_STATUS.SKIPPED, skippedAt: new Date() } },
            );
            customHabit.isActive = false;
            await customHabit.save()

            await disconnectFromParents(customHabit._id);

            return null;
        }

        if (userHabit) {
            userHabit.isActive = false;
            userHabit.parent = null;
            await userHabit?.save();

            await HabitLog.findOneAndUpdate(
                { userHabit: userHabit._id, date: String(date), status: 'Pending' },
                { $set: { status: 'Skipped', skippedAt: new Date() } },
            );

            // Disconnect from the parent's connectedHabits
            await disconnectFromParents(userHabit._id);

            return null;
        }

    }

    // ─────────────────────────────────────────────────────────
    //  ACTIVATE PATH
    // ─────────────────────────────────────────────────────────
    const template = await HabitTemplate.findById(habitId).lean();

    if (!template) {
        // check it is custom habit activation with template null
        const userCustomHabit = await UserHabit.findOne({ user: userId, _id: habitId, template: null }).lean();
        if (!userCustomHabit) {
            throw new NotFoundError('Habit template not found');
        }

        if (userCustomHabit.isActive) {
            throw new BadRequestError('Habit is already active');
        }
        const existingLog = await HabitLog.findOne({
            userHabit: userCustomHabit._id,
            date: String(date),
        });

        if (existingLog) {
            if (existingLog.status === 'Skipped') {
                existingLog.status = 'Pending';
                existingLog.skippedAt = null;
                await existingLog.save();
            }
        } else {
            await HabitLog.create({
                user: userId,
                userHabit: userCustomHabit._id,
                date: String(date),
                status: 'Pending',
            });
        }
        await UserHabit.updateOne(
            { _id: userCustomHabit._id },
            { $set: { isActive: true, startDate: new Date() } }
        );

        return { added: [{ _id: userCustomHabit._id, name: userCustomHabit.name }], skipped: null };
    }

    // non custom habit activation with template found but inactive
    if (!template?.isActive) throw new BadRequestError('This habit is no longer available');

    const childTemplates = await HabitTemplate.find({
        group: habitId,
        isActive: true,
    }).lean();

    const isGroup = childTemplates.length > 0;

    // ── CASE 1: Group activate ──
    if (isGroup) {
        const existingHabits = await UserHabit.find({
            user: userId,
            template: { $in: childTemplates.map(c => c._id) },
        }).select('template isActive _id').lean();

        const existingMap = new Map(
            existingHabits.map(h => [h.template?.toString(), h]),
        );

        const toReactivate: Types.ObjectId[] = [];
        const toReactivateWithTemplate: { id: Types.ObjectId; templateId: Types.ObjectId }[] = [];
        const toCreate: typeof childTemplates = [];

        for (const child of childTemplates) {
            const existing = existingMap.get(child._id.toString());
            if (!existing) {
                toCreate.push(child);
            } else if (!existing.isActive) {
                toReactivate.push(existing._id);
                toReactivateWithTemplate.push({
                    id: existing._id,
                    templateId: child._id,
                });
            }
            // already active → skip silently
        }

        if (!toReactivate.length && !toCreate.length) {
            throw new BadRequestError('You have already added all habits from this group.');
        }

        // Reactivate soft-deleted habits
        if (toReactivate.length) {
            await UserHabit.updateMany(
                { _id: { $in: toReactivate } },
                { $set: { isActive: true, startDate: new Date() } },
            );

            // Today log check
            const existingLogs = await HabitLog.find({
                userHabit: { $in: toReactivate },
                date: String(date),
            }).select('userHabit status').lean();

            const existingLogMap = new Map<string, any>(
                existingLogs.map((l: any) => [l.userHabit?.toString(), l]),
            );

            const logsToInsert: Types.ObjectId[] = [];

            for (const id of toReactivate) {
                const existingLog = existingLogMap.get(id.toString());
                if (!existingLog) {
                    logsToInsert.push(id);
                } else if (existingLog.status === 'Skipped') {
                    await HabitLog.updateOne(
                        { userHabit: id, date: String(date) },
                        { $set: { status: 'Pending', skippedAt: null } },
                    );
                }
            }

            if (logsToInsert.length) {
                await HabitLog.insertMany(
                    logsToInsert.map(id => ({
                        user: userId,
                        userHabit: id,
                        date: String(date),
                        status: 'Pending',
                    })),
                );
            }


            const reactivatedTemplates = await HabitTemplate.find({
                _id: { $in: toReactivateWithTemplate.map(r => r.templateId) },
            }).select('_id parent').lean();

            const reactivatedTemplateMap = new Map<string, any>(
                reactivatedTemplates.map((t: any) => [t._id.toString(), t]),
            );

            for (const { id, templateId } of toReactivateWithTemplate) {
                const tmpl = reactivatedTemplateMap.get(templateId.toString());
                if (tmpl?.parent) {
                    await connectToParent(userId, tmpl.parent, id);
                }
            }
        }


        // Brand new habits create (with parent check)
        const skippedNames: string[] = [];
        const canAdd: typeof toCreate = [];

        for (const child of toCreate) {
            if (child.parent) {
                const parentActive = await UserHabit.exists({
                    user: userId,
                    template: child.parent,
                    isActive: true,
                });

                if (!parentActive) {
                    skippedNames.push(child.name);
                    continue;
                }
            }
            canAdd.push(child);
        }

        if (!canAdd.length && !toReactivate.length) {
            throw new BadRequestError(
                `Activate the obligatory prayers first to unlock: ${skippedNames.join(', ')}`,
            );
        }

        let newHabits: any[] = [];
        if (canAdd.length) {
            console.log({ canAdd })
            const payloads = canAdd.map(t => buildHabitPayload(userId, t));
            newHabits = await UserHabit.insertMany(payloads);

            await HabitLog.insertMany(
                newHabits.map(h => ({
                    user: userId,
                    userHabit: h._id,
                    date: String(date),
                    status: 'Pending',
                })),
            );

            for (let i = 0; i < newHabits.length; i++) {
                const tmpl = canAdd[i];
                if (tmpl.parent) {
                    await connectToParent(userId, tmpl.parent, newHabits[i]._id);
                }
            }
        }

        return {
            added: newHabits.map(h => ({ _id: h._id, name: h.name })),
            reactivated: toReactivate.map(id => ({ _id: id })),
            skipped: skippedNames.length
                ? `${skippedNames.join(', ')} skipped — activate the required habits first`
                : null,
        };
    }

    // ── CASE 2: Single activate ──
    const existingHabit = await UserHabit.findOne({
        user: userId,
        template: habitId,
    });

    if (existingHabit) {
        if (existingHabit.isActive) {
            throw new BadRequestError('habit is already activated.');
        }

        // Check Parent active
        if (template.parent) {
            const parentActive = await UserHabit.exists({
                user: userId,
                template: template.parent,
                isActive: true,
            });

            if (!parentActive) {
                throw new BadRequestError(
                    'Activate the required habit first to unlock this habit.',
                );
            }
        }

        if (template.isConnectedObligatory) {

            const connectedTempaltes = await UserHabit.find({
                user: userId,
                habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
            });

            for (const connectedTemplate of connectedTempaltes) {
                await connectToParent(userId, connectedTemplate._id, existingHabit._id);
            }
        }

        existingHabit.isActive = true;
        existingHabit.startDate = new Date();
        await existingHabit.save();

        // Log handle
        const existingLog = await HabitLog.findOne({
            userHabit: existingHabit._id,
            date: String(date),
        });

        if (existingLog) {
            if (existingLog.status === 'Skipped') {
                existingLog.status = 'Pending';
                existingLog.skippedAt = null;
                await existingLog.save();
            }
        } else {
            await HabitLog.create({
                user: userId,
                userHabit: existingHabit._id,
                date: String(date),
                status: 'Pending',
            });
        }

        // reconnect to parent habits
        if (template.parent) {
            await connectToParent(userId, template.parent, existingHabit._id);
        }

        return { added: [{ _id: existingHabit._id, name: existingHabit.name }], skipped: null };
    }

    // No existing habit — create fresh
    if (template.parent) {
        const parentActive = await UserHabit.exists({
            user: userId,
            template: template.parent,
            isActive: true,
        });

        if (!parentActive) {
            throw new BadRequestError(
                'Activate the required habit first to unlock this habit.',
            );
        }
    }

    // Cast to any to satisfy Mongoose create overload typing when payload contains nullable fields
    const newHabit = await UserHabit.create(buildHabitPayload(userId, template) as any);

    await HabitLog.create({
        user: userId,
        userHabit: newHabit._id,
        date: String(date),
        status: 'Pending',
    });

    // Connect to the parent's connectedHabits
    if (template.parent) {
        await connectToParent(userId, template.parent, newHabit._id);
    }

    if (template.isConnectedObligatory) {

        const connectedTempaltes = await UserHabit.find({
            user: userId,
            habitType: HABIT_TYPES.OBLIGATORY_PRAYER,
        });

        for (const connectedTemplate of connectedTempaltes) {
            await connectToParent(userId, connectedTemplate._id, newHabit._id);
        }
    }
    return { added: [{ _id: newHabit._id, name: newHabit.name }], skipped: null };
};

*/