import { gql } from '@apollo/client';

export const GET_ME = gql`
  query GetMe {
    me {
      id
      orgId
      name
      email
      role
      isEmailVerified
      lastLogin
    }
  }
`;

export const GET_COMPANIES = gql`
  query GetCompanies {
    companies {
      id
      name
      description
      isActive
      isCoreBranch
      createdAt
    }
  }
`;

export const GET_CATEGORIES = gql`
  query GetCategories($companyId: ID) {
    categories(companyId: $companyId) {
      id
      orgId
      companyId
      name
      group
      groupLabel
      isGlobal
      subcategories {
        name
        items
        isCustom
      }
    }
  }
`;

export const GET_PAYMENT_METHODS = gql`
  query GetPaymentMethods {
    paymentMethods {
      id
      name
      type
      accountNumber
      isActive
      createdAt
    }
  }
`;

export const GET_EXPENSES = gql`
  query GetExpenses($filter: ExpenseFilter, $page: Int, $limit: Int) {
    expenses(filter: $filter, page: $page, limit: $limit) {
      expenses {
        id
        companyId
        date
        categoryId
        categoryName
        subcategory
        amount
        vendor
        paymentMethodId
        paymentMethodName
        notes
        createdAt
      }
      totalCount
      page
      totalPages
    }
  }
`;

export const GET_INCOMES = gql`
  query GetIncomes($filter: IncomeFilter, $page: Int, $limit: Int) {
    incomes(filter: $filter, page: $page, limit: $limit) {
      incomes {
        id
        companyId
        date
        amount
        source
        notes
        createdAt
      }
      totalCount
      page
      totalPages
    }
  }
`;

export const GET_BUDGET_BUCKETS = gql`
  query GetBudgetBuckets($companyId: ID) {
    budgetBuckets(companyId: $companyId) {
      id
      companyId
      categoryId
      categoryName
      name
      limitAmount
      period
      alertThreshold
      startDate
      endDate
      subcatBudgets {
        subcategory
        limitAmount
      }
    }
  }
`;

export const GET_ALL_BUDGET_USAGES = gql`
  query GetAllBudgetUsages($companyId: ID) {
    allBudgetUsages(companyId: $companyId) {
      bucket {
        id
        companyId
        categoryId
        categoryName
        name
        limitAmount
        period
        alertThreshold
        subcatBudgets {
          subcategory
          limitAmount
        }
      }
      usedAmount
      remainingAmount
      percentUsed
      isOverBudget
      isNearLimit
      subcatUsages {
        subcategory
        limitAmount
        usedAmount
        remainingAmount
        percentUsed
        isOverBudget
      }
    }
  }
`;

export const GET_DASHBOARD_SUMMARY = gql`
  query GetDashboardSummary($filter: DashFilter) {
    dashboardSummary(filter: $filter) {
      totalExpenses
      totalIncome
      netBalance
      expenseCount
      incomeCount
      topCategory
      topVendor
    }
  }
`;

export const GET_CATEGORY_BREAKDOWN = gql`
  query GetCategoryBreakdown($filter: DashFilter) {
    categoryBreakdown(filter: $filter) {
      categoryName
      amount
      count
      percentage
    }
  }
`;

export const GET_MONTHLY_TREND = gql`
  query GetMonthlyTrend($months: Int, $companyId: ID) {
    monthlyTrend(months: $months, companyId: $companyId) {
      month
      year
      amount
    }
  }
`;

export const GET_INCOME_EXPENSE_TREND = gql`
  query GetIncomeExpenseTrend($months: Int, $companyId: ID) {
    incomeVsExpenseTrend(months: $months, companyId: $companyId) {
      month
      year
      expenses
      income
      net
    }
  }
`;

export const GET_TOP_VENDORS = gql`
  query GetTopVendors($filter: DashFilter, $limit: Int) {
    topVendors(filter: $filter, limit: $limit) {
      vendor
      amount
      count
    }
  }
`;

export const GET_PAYMENT_METHOD_BREAKDOWN = gql`
  query GetPaymentMethodBreakdown($filter: DashFilter) {
    paymentMethodBreakdown(filter: $filter) {
      paymentMethodName
      amount
      count
    }
  }
`;

export const GET_COMPANY_SPEND_BREAKDOWN = gql`
  query GetCompanySpendBreakdown($filter: DashFilter) {
    companySpendBreakdown(filter: $filter) {
      companyId
      companyName
      expenses
      income
      netBalance
      expenseCount
      percentage
    }
  }
`;

export const GET_CHAT_SESSION = gql`
  query GetChatSession($sessionId: String!) {
    chatSession(sessionId: $sessionId) {
      id
      sessionId
      messages {
        role
        content
        timestamp
      }
    }
  }
`;
