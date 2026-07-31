const getApiBaseUrl = () => {
    if (typeof window === 'undefined') {
        return 'http://localhost:3000';
    }

    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:3000`;
};

export const API_BASE_URL = getApiBaseUrl();

export default API_BASE_URL;
