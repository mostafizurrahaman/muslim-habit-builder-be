import { BadRequestError, NotFoundError } from "../../../errors/request/apiError";
import { HabitTemplate } from "../habit-template/system.habit.model";
import { AdhkarSet } from "./adhkar.set.model";
import { TAdhakarItemPayload, TAdhakarPayload, TUpdateAdhakarItemPayload, TUpdateAdhakarSetPayload } from "./adhkar.set.zod";



// 1. Create a new Adhkar Set
const createAdhakar = async (payload: TAdhakarPayload) => {
    const isExist = await AdhkarSet.findOne({ name: payload.name });
    if (isExist) {
        throw new BadRequestError('Adhkar set with this name already exists');
    }
    const result = await AdhkarSet.create(payload);
    return result;
};

// 2. Delete the main Adhkar Set completely
const deleteAdhakarSet = async (setId: string) => {
    const adhkar = await AdhkarSet.findById(setId);

    if (!adhkar) {
        throw new NotFoundError('Adhkar set not found');
    }

    await HabitTemplate.findOneAndUpdate({ adhkarSet: setId }, { $unset: { adhkarSet: null }, new: true });
    return null;
};

const getAdhkars = async () => {
    const result = await AdhkarSet.find().select('name _id items');
    return result.map(item => {
        return {
            id: item._id,
            name: item.name,
            items: item.items.length
        }
    });
}

const updateAdhakarSet = async (id: string, payload: TUpdateAdhakarSetPayload) => {
    const result = await AdhkarSet.findByIdAndUpdate(id, payload, { new: true, runValidators: true });

    if (!result) {
        throw new NotFoundError("Adhkar set not found to update");
    }
    return null;
}

// 3. Add a new sub-item into an Adhkar Set
const addAdhakarItem = async (setId: string, itemPayload: TAdhakarItemPayload) => {
    const adhakarSet = await AdhkarSet.findById(setId);
    if (!adhakarSet) {
        throw new NotFoundError('Adhkar set not found');
    }


    // Auto-assign order tracking based on current length
    const nextOrder = adhakarSet.items.length + 1;

    const newItem = {
        ...itemPayload,
        order: nextOrder,
        // Ensure `count` is explicitly set to number or null (not undefined)
        count: itemPayload.count ?? null,
    };

    // Mongoose tracks array pushes naturally; markModified is not required
    adhakarSet.items.push(newItem);
    adhakarSet.totalCount = adhakarSet.items.length;

    await adhakarSet.save();
    return adhakarSet;
};

// update adhkar item
const updateAdhakarItem = async (setId: string, itemIndex: number, updatePayload: TUpdateAdhakarItemPayload) => {
    console.log('Updating Adhkar Item:', { setId, itemIndex, updatePayload });
    const adhakarSet = await AdhkarSet.findById(setId);
    if (!adhakarSet) {
        throw new NotFoundError('Adhkar set not found');
    }

    // Validate if the provided index exists in the array bounds
    if (itemIndex < 0 || itemIndex >= adhakarSet.items.length) {
        throw new BadRequestError('Invalid item index provided');
    }

    // Mutate individual properties directly on the specific array index
    const item = adhakarSet.items[itemIndex];
    if (updatePayload.title) item.title = updatePayload.title;
    if (updatePayload.arabic) item.arabic = updatePayload.arabic;
    if (updatePayload.transliteration) item.transliteration = updatePayload.transliteration;
    if (updatePayload.translation) item.translation = updatePayload.translation;
    if (updatePayload.virtue !== undefined) item.virtue = updatePayload.virtue;
    if (updatePayload.reference !== undefined) item.reference = updatePayload.reference;
    if (updatePayload.count !== undefined) item.count = updatePayload.count;

    await adhakarSet.save();
    return adhakarSet;
};

// 5. Delete an Adhkar Item using Array Index and close the ordering gap
const deleteAdhakarItem = async (setId: string, itemIndex: number) => {
    const adhakarSet = await AdhkarSet.findById(setId);
    if (!adhakarSet) {
        throw new NotFoundError('Adhkar set not found');
    }

    // Validate if the provided index exists in the array bounds
    if (itemIndex < 0 || itemIndex >= adhakarSet.items.length) {
        throw new BadRequestError('Invalid item index provided');
    }

    const deletedOrder = adhakarSet.items[itemIndex].order;

    // Remove the item directly using the index via splice
    adhakarSet.items.splice(itemIndex, 1);

    // Synchronize order values sequentially for the remaining items
    adhakarSet.items.forEach((item) => {
        if (item.order > deletedOrder) {
            item.order -= 1;
        }
    });

    adhakarSet.totalCount = adhakarSet.items.length;

    await adhakarSet.save();
    return null;
};

// 6. Preview and fetch the full Adhkar Set ordered sequentially
const getAdhakarPreview = async (setId: string) => {
    const adhakarSet = await AdhkarSet.findById(setId);
    if (!adhakarSet) {
        throw new NotFoundError('Adhkar set not found');
    }

    // Sort array elements internally by their assigned sequential orders
    adhakarSet.items.sort((a, b) => a.order - b.order);

    return adhakarSet;
};


const reorderAdhkarItemsByIndex = async (
    setId: string,
    payload: { itemIndex: number; newOrder: number }
) => {
    // 1. Fetch the full document to update fields cleanly
    const adhakarSet = await AdhkarSet.findById(setId);

    if (!adhakarSet) {
        throw new NotFoundError('Adhkar set not found');
    }

    const totalItems = adhakarSet.items.length;


    if (totalItems < 2) {
        throw new BadRequestError('at least 2 items are required to reorder the items');
    }


    // Validate that the provided itemIndex falls within the bounds of the array
    if (payload.itemIndex < 0 || payload.itemIndex >= totalItems) {
        throw new BadRequestError(`Invalid itemIndex`);
    }


    // 2. Extract the item array into a plain JS array to perform operations safely
    const itemsArray = [...adhakarSet.items];

    // 3. Remove the target item from its current index position
    const [targetItem] = itemsArray.splice(payload.itemIndex, 1);

    // 4. Calculate target array index based on the requested 1-based order
    const targetArrayIndex = payload.newOrder - 1;

    // 5. Insert the target item cleanly at its new position
    itemsArray.splice(targetArrayIndex, 0, targetItem);

    // 6. Loop through the array and systematically re-assign sequential 1-based order values
    itemsArray.forEach((item, index) => {
        item.order = index + 1;
    });

    // 7. Reassign the sorted array back to the Mongoose document field
    adhakarSet.items = itemsArray as any;

    // 8. Save the modifications down to the database
    await adhakarSet.save();

    return adhakarSet;
};


const getAdhkarSetNames = async () => {
    const result = await AdhkarSet.find().select('name _id');
    return result.map(item => {
        return {
            id: item._id,
            name: item.name
        }
    });
}


export const adhakarService = {
    createAdhakar,
    deleteAdhakarSet,
    addAdhakarItem,
    updateAdhakarItem,
    deleteAdhakarItem,
    reorderAdhkarItemsByIndex,
    getAdhakarPreview,
    getAdhkarSetNames,
    getAdhkars,
    updateAdhakarSet
};