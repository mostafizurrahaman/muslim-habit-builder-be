import { Router } from "express";
import userOverviewRouter from "./overview/overview.route";
import userManagementRouter from "./user-management/user.management.route";

import authMiddleware from "../../middlewares/auth.middleware";
import quranContentRouter from "./quran-content/quran.content.route";
import { USER_ROLE } from "../user/user.constant";
import { adminController } from "./admin/admin.controller";
import announcementRouter from "./announcement/announcement.route";
import userBugRouter from "./bugs/bug.route";
import discountRouter from "./discount/discount.route";
import adhkarRouter from "./adhkar-set/adhkar.set.route";
import habitTemplateRouter from "./habit-template/system.habit.route";


const adminRouter = Router();


adminRouter.use('/users', userManagementRouter);
adminRouter.use('/overview', userOverviewRouter);
adminRouter.use('/quran-content', quranContentRouter);
adminRouter.use('/adhkar-sets', adhkarRouter);
adminRouter.use('/habit-template', habitTemplateRouter);
adminRouter.use('/bugs', userBugRouter);
adminRouter.use('/get-me', authMiddleware(USER_ROLE.ADMIN,USER_ROLE.SUPER_ADMIN), adminController.getMeIntoDb);
adminRouter.use('/update-profile', authMiddleware(USER_ROLE.ADMIN,USER_ROLE.SUPER_ADMIN), adminController.updateAdminProfileIntoDb);
adminRouter.use('/announcement', announcementRouter);
adminRouter.use('/discount', discountRouter);

export default adminRouter;