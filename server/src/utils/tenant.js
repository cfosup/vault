import { GraphQLError } from 'graphql';
import { Company } from '../models/Company.js';

export const assertCompaniesInOrg = async (companyIds, orgId) => {
  const ids = [...new Set((companyIds || []).filter(Boolean).map((id) => id.toString()))];
  if (ids.length === 0) return;

  const found = await Company.find({ _id: { $in: ids }, orgId }).select('_id');
  if (found.length !== ids.length) {
    throw new GraphQLError('Company not found in your organization.', {
      extensions: { code: 'NOT_FOUND', http: { status: 404 } },
    });
  }
};
