import express from 'express';
import authRouter from '../modules/auth/auth.route';
import bugRouter from '../modules/bug/bug.route';
import { contentRouter } from '../modules/content/content.route';
import adminRouter from '../modules/dashboard';
import habitTemplateRouter from '../modules/dashboard/habit-template/system.habit.route';
import faqRouter from '../modules/Faq/faq.route';
import habitProgressRouter from '../modules/habit-progress/habit.progress.route';
import userHabitRouter from '../modules/user-habit/user.habit.route';
import userRouter from '../modules/user/user.route';


const routersVersionOne = express.Router();

const appRouters = [
  {
    path: '/user',
    router: userRouter,
  },
  {
    path: '/auth',
    router: authRouter,
  },

  {
    path: '/content',
    router: contentRouter,
  },

  {
    path: '/user-habit',
    router: userHabitRouter,
  },

  {
    path: '/admin',
    router: adminRouter,
  },

  {
    path: '/progress',
    router: habitProgressRouter,
  },

  {
    path: '/bug',
    router: bugRouter,
  },

  {
    path: '/faq',
    router: faqRouter,
  },
];

appRouters.forEach((router) => {
  routersVersionOne.use(router.path, router.router);
});

export default routersVersionOne;
