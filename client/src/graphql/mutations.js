import { gql } from '@apollo/client';

export const REGISTER = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        orgId
        name
        email
        role
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
    }
  }
`;

export const DELETE_EXPENSE = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id)
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

export const SEND_CHAT_MESSAGE = gql`
  mutation SendChatMessage($sessionId: String!, $message: String!) {
    sendChatMessage(sessionId: $sessionId, message: $message) {
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
