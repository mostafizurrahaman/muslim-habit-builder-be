import { HABIT_CATEGORIES } from "../../../../interfaces";
import { BadRequestError } from "../../../errors/request/apiError";
import { PRAYER_HABIT_TYPES } from "./system.habit.constant";
import { EffectiveHabitTemplateFields } from "./system.habit.interface";
import { HabitTemplate } from "./system.habit.model";



export const validateHabitTemplateRules = async (effective: EffectiveHabitTemplateFields) => {
    if (effective.group && effective.parent) {
        throw new BadRequestError(
            "A habit cannot be both a group and a child of another habit. Please provide either 'group' or 'parent', not both.",
        );
    }
 
    if (effective.group) {
        const groupExists = await HabitTemplate.exists({ _id: effective.group });
        if (!groupExists) {
            throw new BadRequestError('Referenced group habit does not exist.');
        }
    }
 
    if (effective.parent) {
        const parentHabit = await HabitTemplate.findById(effective.parent).select('connectedPrayer');
        if (!parentHabit) {
            throw new BadRequestError('Referenced parent habit does not exist.');
        }
 
        if (parentHabit.connectedPrayer !== effective.connectedPrayer) {
            throw new BadRequestError(
                'connectedPrayer of parent habit does not match with the connectedPrayer of the new habit.',
            );
        }
    }
 
    if (
        effective.category === HABIT_CATEGORIES.PRAYER &&
        !PRAYER_HABIT_TYPES.includes(effective.habitType as (typeof PRAYER_HABIT_TYPES)[number])
    ) {
        throw new BadRequestError(
            'Invalid habitType for prayer category. Allowed types: ' + PRAYER_HABIT_TYPES.join(', '),
        );
    }
 
    if (effective.connectedPrayer && effective.isPrayerLocked) {
        const allowedConnectedPrayers = effective.allowConnectedPrayers || [];
        if (!allowedConnectedPrayers.includes(effective.connectedPrayer) && allowedConnectedPrayers.length > 1) {
            throw new BadRequestError(
                'This is prayer locked habit so you can only chose in allowedConnected prayer that you select connected prayer.',
            );
        }
    }
 
    if (effective.isConnectedObligatory && (effective.isPrayerLocked || effective.isLocked) && effective.connectedPrayer) {
        throw new BadRequestError(
            'This habit is connected to an obligatory prayer, so it cannot be locked or prayer locked. it will be connected all obligatory prayers',
        );
    }
 
    if (
        (effective.category === HABIT_CATEGORIES.DHIKR && effective.quranContent) ||
        (effective.category === HABIT_CATEGORIES.QURAN && effective.adhkarSet)
    ) {
        throw new BadRequestError(
            'Quran content is only allowed for Quran category and Adhkar set is only allowed for Dhikr category.',
        );
    }
};
 