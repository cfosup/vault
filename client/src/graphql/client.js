import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { useAuthStore, isTokenExpired } from '../store/authStore';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql',
});

const authLink = setContext((_, { headers }) => {
  const rawToken = localStorage.getItem('vault_token') || localStorage.getItem('expenseflow_token');
  const token = rawToken && rawToken !== 'undefined' && rawToken !== 'null' && !isTokenExpired(rawToken)
    ? rawToken
    : '';

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  let isUnauthenticated = false;

  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const code = err.extensions?.code;
      const msg = err.message || '';
      if (
        code === 'UNAUTHENTICATED' ||
        msg.includes('Authentication required') ||
        msg.includes('jwt expired') ||
        msg.includes('invalid signature')
      ) {
        isUnauthenticated = true;
        break;
      }
    }
  }

  if (networkError && 'statusCode' in networkError && networkError.statusCode === 401) {
    isUnauthenticated = true;
  }

  if (isUnauthenticated) {
    try {
      useAuthStore.getState().logout();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login?expired=true';
    }
  }
});

export const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

export default client;
