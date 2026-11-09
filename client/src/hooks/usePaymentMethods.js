import { useQuery } from '@apollo/client/react';
import { GET_PAYMENT_METHODS, GET_PAYMENT_METHODS_BASIC } from '../graphql/queries';

function missingAddedBy(error) {
  const parts = [
    error?.message,
    ...(error?.graphQLErrors || []).map((item) => item.message),
    ...(error?.errors || []).map((item) => item.message),
  ];
  return parts.filter(Boolean).join(' ').includes('createdByName');
}

export function usePaymentMethods() {
  const full = useQuery(GET_PAYMENT_METHODS, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network',
  });
  const basic = useQuery(GET_PAYMENT_METHODS_BASIC, {
    skip: !missingAddedBy(full.error),
    fetchPolicy: 'cache-and-network',
  });

  const refetch = async () => {
    try {
      const result = await full.refetch();
      if (!missingAddedBy(result?.error)) return result;
    } catch (error) {
      if (!missingAddedBy(error)) throw error;
    }
    return basic.refetch();
  };

  return {
    paymentMethods: full.data?.paymentMethods || basic.data?.paymentMethods || [],
    loading: full.loading || basic.loading,
    refetch,
  };
}
