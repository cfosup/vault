import { authResolvers } from './authResolvers.js';
import { companyResolvers } from './companyResolvers.js';
import { categoryResolvers } from './categoryResolvers.js';
import { paymentMethodResolvers } from './paymentMethodResolvers.js';
import { expenseResolvers } from './expenseResolvers.js';
import { incomeResolvers } from './incomeResolvers.js';
import { budgetResolvers } from './budgetResolvers.js';
import { dashboardResolvers } from './dashboardResolvers.js';
import { chatResolvers } from './chatResolvers.js';
import { adminResolvers } from './adminResolvers.js';
import { featureResolvers } from './featureResolvers.js';

export const resolvers = {
  Expense: expenseResolvers.Expense,
  Income: incomeResolvers.Income,
  User: featureResolvers.User,
  Query: {
    ...authResolvers.Query,
    ...companyResolvers.Query,
    ...categoryResolvers.Query,
    ...paymentMethodResolvers.Query,
    ...expenseResolvers.Query,
    ...incomeResolvers.Query,
    ...budgetResolvers.Query,
    ...dashboardResolvers.Query,
    ...chatResolvers.Query,
    ...adminResolvers.Query,
    ...featureResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...companyResolvers.Mutation,
    ...categoryResolvers.Mutation,
    ...paymentMethodResolvers.Mutation,
    ...expenseResolvers.Mutation,
    ...incomeResolvers.Mutation,
    ...budgetResolvers.Mutation,
    ...chatResolvers.Mutation,
    ...adminResolvers.Mutation,
    ...featureResolvers.Mutation,
  },
};

export default resolvers;
