const ACCESS_KEY = "finance_access_token";
const REFRESH_KEY = "finance_refresh_token";

const localStore = window.localStorage;
const sessionStore = window.sessionStorage;

const readToken = (key) => sessionStore.getItem(key) || localStore.getItem(key);

const getActiveStore = () => {
  if (sessionStore.getItem(ACCESS_KEY) || sessionStore.getItem(REFRESH_KEY)) {
    return sessionStore;
  }
  return localStore;
};

export const getAccessToken = () => readToken(ACCESS_KEY);
export const getRefreshToken = () => readToken(REFRESH_KEY);

export const setTokens = ({ access, refresh }, { remember } = {}) => {
  const targetStore =
    typeof remember === "boolean" ? (remember ? localStore : sessionStore) : getActiveStore();
  const otherStore = targetStore === localStore ? sessionStore : localStore;

  if (access) targetStore.setItem(ACCESS_KEY, access);
  if (refresh) targetStore.setItem(REFRESH_KEY, refresh);

  otherStore.removeItem(ACCESS_KEY);
  otherStore.removeItem(REFRESH_KEY);
};

export const clearTokens = () => {
  localStore.removeItem(ACCESS_KEY);
  localStore.removeItem(REFRESH_KEY);
  sessionStore.removeItem(ACCESS_KEY);
  sessionStore.removeItem(REFRESH_KEY);
};
