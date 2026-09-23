import { authResolvers } from './authResolvers.js';
import { companyResolvers } from './companyResolvers.js';
import { categoryResolvers } from './categoryResolvers.js';
import { paymentMethodResolvers } from './paymentMethodResolvers.js';
import { expenseResolvers } from './expenseResolvers.js';
import { incomeResolvers } from './incomeResolvers.js';
import { budgetResolvers } from './budgetResolvers.js';
import { dashboardResolvers } from './dashboardResolvers.js';
import { chatResolvers } from './chatResolvers.js';

export const resolvers = {
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
  },
};

export default resolvers;
