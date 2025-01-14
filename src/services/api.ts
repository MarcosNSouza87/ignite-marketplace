import {
	storageAuthTokenGet,
	storageAuthTokenSave,
} from '@storage/storageAuthToken';
import { AppError } from '@utils/AppError';
import axios, { AxiosError, AxiosInstance } from 'axios';

type SignOut = () => void;

type PromiseType = {
	onSuccess: (token: string) => void;
	onFailure: (error: AxiosError) => void;
};

type APIInstanceProps = AxiosInstance & {
	registerInterceptTokenManager: (signOut: SignOut) => () => void;
};

export const api = axios.create({
	baseURL: 'http://127.0.0.1:3333',
}) as APIInstanceProps;

let failetQueue: Array<PromiseType> = [];
let isRefresing = false;

api.registerInterceptTokenManager = (signOut) => {
	const interceptTokenManager = api.interceptors.request.use(
		(response) => response,
		async (requestError) => {
			if (requestError?.response?.status === 401) {
				if (
					requestError.response.data?.message === 'token.expired' ||
					requestError.response.data?.message === 'token.invalid'
				) {
					const { refresh_token } = await storageAuthTokenGet();
					if (!refresh_token) {
						signOut();
						return Promise.reject(requestError);
					}

					const originalRequestConfig = requestError.config;
					if (isRefresing) {
						return new Promise((resolve, reject) => {
							failetQueue.push({
								onSuccess: (token: string) => {
									originalRequestConfig.headers = {
										Authorization: `Bearer ${token}`,
									};
									resolve(api(originalRequestConfig));
								},
								onFailure: (error: AxiosError) => {
									reject(error);
								},
							});
						});
					}

					isRefresing = true;

					return new Promise(async (resolve, reject) => {
						try {
							const { data } = await api.post('/sessions/refresh-token', {
								refresh_token,
							});
							await storageAuthTokenSave({
								token: data.token,
								refresh_token: data.refresh_token,
							});

							if (originalRequestConfig.data) {
								originalRequestConfig.data = JSON.parse(originalRequestConfig.data);
							}

							originalRequestConfig.headers = {
								Authorization: `Bearer ${data.token}`,
							};

							api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;

							failetQueue.forEach((request) => {
								request.onSuccess(data.token);
							});

							resolve(api(originalRequestConfig));
              //

              console.log('token update')
						} catch (error: any) {
							failetQueue.forEach((request) => {
								request.onFailure(error);
							});

							signOut();
							reject(error);
						} finally {
							isRefresing = false;
							failetQueue = [];
						}
					});
				}

				signOut();
			}

			if (requestError.response && requestError.response.data) {
				return Promise.reject(new AppError(requestError.response.data.message));
			} else {
				return Promise.reject(
					new AppError('Erro no servidor. Tente novamente mais tarde.'),
				);
			}
		},
	);

	return () => {
		api.interceptors.response.eject(interceptTokenManager);
	};
};
