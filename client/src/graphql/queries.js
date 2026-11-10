import { gql } from '@apollo/client';

export const GET_MY_ACTIVITY = gql`
  query GetMyActivity($limit: Int) {
    myActivityLogs(limit: $limit) {
      id
      action
      description
      companyName
      createdAt
    }
  }
`;

export const GET_EXPENSE = gql`
  query GetExpense($id: ID!) {
    expense(id: $id) {
      id
      companyId
      date
      categoryId
      categoryName
      subcategory
      amount
      vendor
      paymentMethodId
      notes
      incomeId
    }
  }
`;

export const GET_INCOME = gql`
  query GetIncome($id: ID!) {
    income(id: $id) {
      id
      companyId
      date
      amount
      source
      notes
    }
  }
`;

export const GET_COMPANY = gql`
  query GetCompany($id: ID!) {
    company(id: $id) {
      id
      name
      description
      isActive
      isCoreBranch
    }
  }
`;

export const GET_CATEGORY = gql`
  query GetCategory($id: ID!) {
    category(id: $id) {
      id
      name
      group
      groupLabel
      subcategories { name items isCustom }
    }
  }
`;

export const GET_PAYMENT_METHOD = gql`
  query GetPaymentMethod($id: ID!) {
    paymentMethod(id: $id) {
      id
      name
      type
      accountNumber
      isActive
    }
  }
`;

export const GET_BUDGET_BUCKET = gql`
  query GetBudgetBucket($id: ID!) {
    budgetBucket(id: $id) {
      id
      companyId
      categoryId
      name
      limitAmount
      period
      alertThreshold
    }
  }
`;

export const GET_BUDGET_USAGE = gql`
  query GetBudgetUsage($bucketId: ID!) {
    budgetUsage(bucketId: $bucketId) {
      usedAmount
      remainingAmount
      percentUsed
      isOverBudget
      bucket { id name limitAmount }
    }
  }
`;

export const GET_ADMIN_API_METRICS = gql`
  query GetAdminApiMetrics {
    adminApiMetrics {
      totalCalls
      totalErrors
      overallSuccessRate
      endpoints { endpoint path method calls errors successRate lastCalledAt }
      recentErrors { id endpoint statusCode errorMessage timestamp }
    }
  }
`;

export const GET_ADMIN_CHATBOT_USAGE = gql`
  query GetAdminChatbotUsage {
    adminChatbotUsage {
      userId
      userName
      sessionCount
      totalMessagesCount
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      orgId
      name
      email
      role
      isEmailVerified
      accessScope
      modules
      companyIds
      canDeleteExpenses
      canDeleteIncome
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
      createdByName
      createdAt
    }
  }
`;

export const GET_PAYMENT_METHODS_BASIC = gql`
  query GetPaymentMethodsBasic {
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
        incomeId
        incomeIds
        incomeAllocations {
          incomeId
          amount
          companyId
        }
        income {
          id
          source
          amount
        }
        incomes {
          id
          companyId
          source
          amount
        }
        createdAt
      }
      totalCount
      totalAmount
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
      totalAmount
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

export const GET_COMPANY_INCOME_USAGE = gql`
  query GetCompanyIncomeUsage($companyId: ID!) {
    companyIncomeUsage(companyId: $companyId) {
      companyId
      companyName
      totalIncome
      totalUtilized
      remainingBalance
      totalExcessSpending
      utilizationPercentage
      unlinkedExpensesTotal
      unlinkedExpenseCount
      incomeCount
      incomeEntries {
        id
        companyId
        source
        date
        amount
        notes
        totalUtilized
        remainingBalance
        excessSpending
        utilizationPercentage
        linkedExpenseCount
        linkedExpenses {
          id
          companyId
          date
          categoryName
          subcategory
          amount
          vendor
          notes
        }
      }
    }
  }
`;

export const GET_ALL_COMPANIES_INCOME_USAGE = gql`
  query GetAllCompaniesIncomeUsage {
    allCompaniesIncomeUsage {
      companyId
      companyName
      totalIncome
      totalUtilized
      remainingBalance
      totalExcessSpending
      utilizationPercentage
      unlinkedExpensesTotal
      unlinkedExpenseCount
      incomeCount
      incomeEntries {
        id
        source
        date
        amount
        totalUtilized
        remainingBalance
        excessSpending
        utilizationPercentage
        linkedExpenseCount
      }
    }
  }
`;

export const GET_EXPENSES_BY_INCOME = gql`
  query GetExpensesByIncome($incomeId: ID!) {
    expensesByIncome(incomeId: $incomeId) {
      id
      companyId
      date
      categoryName
      subcategory
      amount
      vendor
      notes
      paymentMethodName
    }
  }
`;

export const CHECK_EMAIL_EXISTS = gql`
  query CheckEmailExists($email: String!) {
    checkEmailExists(email: $email)
  }
`;

export const GET_ADMIN_DASHBOARD = gql`
  query GetAdminDashboard($search: String, $role: String) {
    adminDashboard(search: $search, role: $role) {
      stats {
        totalUsers
        totalOrganizations
        totalCompanies
        totalIncomeCount
        totalExpenseCount
        totalInteractions
        totalChatMessages
        activeUsersCount
      }
      users {
        id
        name
        email
        role
        authProvider
        avatarUrl
        isEmailVerified
        lastLogin
        createdAt
        orgId
        orgName
        companyCount
        expenseCount
        incomeCount
        totalTransactionsCount
        chatInteractionsCount
        interactionCount
        lastActiveAt
        companies {
          id
          name
          isActive
          isCoreBranch
          expenseCount
          incomeCount
          createdAt
        }
      }
      recentActivities {
        id
        userId
        userName
        userEmail
        action
        entityType
        description
        companyName
        createdAt
      }
      apiMetrics {
        totalCalls
        totalErrors
        overallSuccessRate
        endpoints {
          endpoint
          path
          method
          calls
          errors
          successRate
          lastCalledAt
        }
        recentErrors {
          id
          endpoint
          statusCode
          errorMessage
          timestamp
        }
      }
      chatbotUsage {
        userId
        userName
        userEmail
        sessionCount
        totalMessagesCount
        lastChatAt
      }
    }
  }
`;

export const GET_ADMIN_ACTIVITIES = gql`
  query GetAdminActivities($limit: Int) {
    adminActivityLogs(limit: $limit) {
      id
      userId
      userName
      userEmail
      action
      entityType
      description
      companyName
      createdAt
    }
  }
`;

export const GET_ADMIN_USER_DETAIL = gql`
  query GetAdminUserDetail($userId: ID!) {
    adminUserDetail(userId: $userId) {
      id
      name
      email
      role
      authProvider
      avatarUrl
      isEmailVerified
      lastLogin
      createdAt
      orgId
      orgName
      companyCount
      expenseCount
      incomeCount
      interactionCount
      lastActiveAt
      companies {
        id
        name
        isActive
        isCoreBranch
        expenseCount
        incomeCount
        createdAt
      }
    }
  }
`;

export const GET_ORG_MEMBERS = gql`
  query GetOrgMembers {
    orgMembers { id name email role accessScope modules companyIds canDeleteExpenses canDeleteIncome }
    pendingInvites { id email accessScope modules companyIds canDeleteExpenses canDeleteIncome expiresAt }
  }
`;

export const GET_INVITE_PREVIEW = gql`
  query GetInvitePreview($token: String!) {
    invitePreview(token: $token) { orgName email accessSummary expiresAt }
  }
`;

export const GET_VENDOR_SUGGESTIONS = gql`
  query GetVendorSuggestions($categoryId: ID!, $subcategory: String) {
    vendorSuggestions(categoryId: $categoryId, subcategory: $subcategory)
  }
`;

export const GET_MONTH_LOCKS = gql`
  query GetMonthLocks { monthLocks { id year month } }
`;

export const GET_RECURRING = gql`
  query GetRecurring {
    myRecurringSchedules { id kind companyId dayOfMonth nextRunAt active label }
  }
`;



