import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mergeTypeDefs } from '@graphql-tools/merge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadGraphQLFiles = () => {
  const files = [
    'auth.graphql',
    'company.graphql',
    'category.graphql',
    'paymentMethod.graphql',
    'expense.graphql',
    'income.graphql',
    'budget.graphql',
    'dashboard.graphql',
    'chat.graphql',
  ];

  const typeDefsArray = files.map((file) => {
    const fullPath = path.join(__dirname, file);
    return fs.readFileSync(fullPath, 'utf-8');
  });

  return mergeTypeDefs(typeDefsArray);
};

export const typeDefs = loadGraphQLFiles();
export default typeDefs;
