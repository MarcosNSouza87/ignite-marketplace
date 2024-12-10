import { IStatistic } from '@screens/Statistic';
import { IForm } from './form';

export declare global {
	namespace ReactNavigation {
		interface RootParamList {
			home: undefined;
			homeStack: undefined;
			signIn: undefined;
			signOut: undefined;
			adsDetails: {AdsId: string};
			adsUser: undefined;
			adsCreateEdit: {AdsId?: string};
		}
	}
}
