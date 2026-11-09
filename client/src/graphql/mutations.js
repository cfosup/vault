import { gql } from '@apollo/client';

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      message
      user {
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
      }
      org {
        id
        name
        slug
        plan
      }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
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
      }
      org {
        id
        name
        slug
        plan
      }
    }
  }
`;

export const FIREBASE_OAUTH = gql`
  mutation FirebaseOAuth($input: FirebaseOAuthInput!) {
    firebaseOAuth(input: $input) {
      token
      message
      user {
        id
        orgId
        name
        email
        role
        avatarUrl
        authProvider
        isEmailVerified
        accessScope
        modules
        companyIds
        canDeleteExpenses
        canDeleteIncome
      }
      org {
        id
        name
        slug
        plan
      }
    }
  }
`;

export const SEND_TEST_EMAIL = gql`
  mutation SendTestEmail($email: String!) {
    sendTestEmail(email: $email) {
      success
      message
      messageId
    }
  }
`;

export const CREATE_COMPANY = gql`
  mutation CreateCompany($input: CompanyInput!) {
    createCompany(input: $input) {
      id
      name
      description
      isActive
      isCoreBranch
      createdAt
    }
  }
`;

export const UPDATE_COMPANY = gql`
  mutation UpdateCompany($id: ID!, $input: CompanyInput!) {
    updateCompany(id: $id, input: $input) {
      id
      name
      description
      isActive
      isCoreBranch
    }
  }
`;

export const DELETE_COMPANY = gql`
  mutation DeleteCompany($id: ID!) {
    deleteCompany(id: $id)
  }
`;

export const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CategoryInput!) {
    createCategory(input: $input) {
      id
      orgId
      companyId
      name
      group
      groupLabel
      subcategories {
        name
        items
        isCustom
      }
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const DELETE_CATEGORY_SECTION = gql`
  mutation DeleteCategorySection($companyId: ID!, $group: String!) {
    deleteCategorySection(companyId: $companyId, group: $group)
  }
`;

export const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($id: ID!, $input: CategoryInput!) {
    updateCategory(id: $id, input: $input) {
      id
      name
    }
  }
`;

export const UPDATE_SUBCATEGORY_ITEMS = gql`
  mutation UpdateSubcategoryItems($categoryId: ID!, $subcategoryName: String!, $items: [String!]!) {
    updateSubcategoryItems(categoryId: $categoryId, subcategoryName: $subcategoryName, items: $items) {
      id
      name
    }
  }
`;

export const ADD_SUBCATEGORY = gql`
  mutation AddSubcategory($categoryId: ID!, $subcategoryName: String!, $items: [String!]) {
    addSubcategory(categoryId: $categoryId, subcategoryName: $subcategoryName, items: $items) {
      id
      name
      subcategories {
        name
        items
        isCustom
      }
    }
  }
`;

export const DELETE_SUBCATEGORY = gql`
  mutation DeleteSubcategory($categoryId: ID!, $subcategoryName: String!) {
    deleteSubcategory(categoryId: $categoryId, subcategoryName: $subcategoryName) {
      id
      name
      subcategories {
        name
        items
        isCustom
      }
    }
  }
`;

export const RESET_COMPANY_CATEGORIES_TO_CORE = gql`
  mutation ResetCompanyCategoriesToCore($companyId: ID!) {
    resetCompanyCategoriesToCore(companyId: $companyId) {
      id
      name
      group
      groupLabel
      subcategories {
        name
        items
      }
    }
  }
`;

export const CREATE_PAYMENT_METHOD = gql`
  mutation CreatePaymentMethod($input: PaymentMethodInput!) {
    createPaymentMethod(input: $input) {
      id
      name
      type
      accountNumber
      isActive
    }
  }
`;

export const DELETE_PAYMENT_METHOD = gql`
  mutation DeletePaymentMethod($id: ID!) {
    deletePaymentMethod(id: $id)
  }
`;

export const UPDATE_PAYMENT_METHOD = gql`
  mutation UpdatePaymentMethod($id: ID!, $input: PaymentMethodInput!) {
    updatePaymentMethod(id: $id, input: $input) {
      id
      name
      type
      accountNumber
      isActive
    }
  }
`;

export const CREATE_EXPENSES = gql`
  mutation CreateExpenses($inputs: [ExpenseInput!]!) {
    createExpenses(inputs: $inputs) {
      id
      companyId
      date
      categoryName
      subcategory
      amount
      vendor
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
        source
        amount
        companyId
      }
    }
  }
`;

export const UPDATE_EXPENSE = gql`
  mutation UpdateExpense($id: ID!, $input: ExpenseInput!) {
    updateExpense(id: $id, input: $input) {
      id
      amount
      vendor
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
        source
        amount
        companyId
      }
    }
  }
`;

export const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id)
  }
`;

export const RESTORE_EXPENSE = gql`
  mutation RestoreExpense($id: ID!) {
    restoreExpense(id: $id)
  }
`;

export const CREATE_INCOMES = gql`
  mutation CreateIncomes($inputs: [IncomeInput!]!) {
    createIncomes(inputs: $inputs) {
      id
      companyId
      date
      amount
      source
      notes
    }
  }
`;

export const DELETE_INCOME = gql`
  mutation DeleteIncome($id: ID!) {
    deleteIncome(id: $id)
  }
`;

export const RESTORE_INCOME = gql`
  mutation RestoreIncome($id: ID!) {
    restoreIncome(id: $id)
  }
`;

export const UPDATE_INCOME = gql`
  mutation UpdateIncome($id: ID!, $input: IncomeInput!) {
    updateIncome(id: $id, input: $input) {
      id
      amount
      source
      notes
    }
  }
`;

export const CREATE_BUDGET_BUCKET = gql`
  mutation CreateBudgetBucket($input: BudgetBucketInput!) {
    createBudgetBucket(input: $input) {
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
  }
`;

export const DELETE_BUDGET_BUCKET = gql`
  mutation DeleteBudgetBucket($id: ID!) {
    deleteBudgetBucket(id: $id)
  }
`;

export const UPDATE_BUDGET_BUCKET = gql`
  mutation UpdateBudgetBucket($id: ID!, $input: BudgetBucketInput!) {
    updateBudgetBucket(id: $id, input: $input) {
      id
      name
      limitAmount
      period
      alertThreshold
    }
  }
`;

export const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($sessionId: String!, $message: String!, $activeCompanyId: ID) {
    sendChatMessage(sessionId: $sessionId, message: $message, activeCompanyId: $activeCompanyId) {
      role
      content
      timestamp
    }
  }
`;

export const CLEAR_CHAT_SESSION = gql`
  mutation ClearChatSession($sessionId: String!) {
    clearChatSession(sessionId: $sessionId)
  }
`;

export const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: ID!, $role: String!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      name
      email
      role
    }
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email) {
      success
      message
    }
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($token: String!, $password: String!) {
    resetPassword(token: $token, password: $password) {
      success
      message
    }
  }
`;

export const ADMIN_LOGIN = gql`
  mutation AdminLogin($email: String!, $password: String!) {
    adminLogin(email: $email, password: $password) {
      token
      message
      admin {
        id
        name
        email
        role
      }
    }
  }
`;

export const INVITE_MEMBER = gql`
  mutation InviteMember($input: MemberAccessInput!) {
    inviteMember(input: $input) { success message }
  }
`;

export const ACCEPT_INVITE = gql`
  mutation AcceptInvite($input: AcceptInviteInput!) {
    acceptInvite(input: $input) {
      token
      user { id orgId name email role accessScope modules companyIds canDeleteExpenses canDeleteIncome }
      org { id name slug plan }
    }
  }
`;

export const UPDATE_MEMBER_ACCESS = gql`
  mutation UpdateMemberAccess($userId: ID!, $input: MemberAccessInput!) {
    updateMemberAccess(userId: $userId, input: $input) { id accessScope modules companyIds canDeleteExpenses canDeleteIncome }
  }
`;

export const REMOVE_MEMBER = gql`
  mutation RemoveMember($userId: ID!) { removeMember(userId: $userId) }
`;

export const LOCK_MONTH = gql`
  mutation LockMonth($year: Int!, $month: Int!) { lockMonth(year: $year, month: $month) }
`;

export const UNLOCK_MONTH = gql`
  mutation UnlockMonth($year: Int!, $month: Int!) { unlockMonth(year: $year, month: $month) }
`;

export const STOP_RECURRING = gql`
  mutation StopRecurring($id: ID!) { stopRecurring(id: $id) }
`;
