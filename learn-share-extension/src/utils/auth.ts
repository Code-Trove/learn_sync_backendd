export const setToken = (token: string) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "SET_TOKEN", token }, (response) => {
      resolve(response.status);
    });
  });
};

export const getToken = () => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, (response) => {
      resolve(response.token);
    });
  });
};
