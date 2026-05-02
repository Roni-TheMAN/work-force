import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export type NetworkStatus = {
  isInternetReachable: boolean;
  isConnected: boolean;
};

function mapState(state: NetInfoState): NetworkStatus {
  return {
    isConnected: state.isConnected === true,
    isInternetReachable: state.isInternetReachable === null ? state.isConnected === true : state.isInternetReachable === true,
  };
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  return mapState(await NetInfo.fetch());
}

export function subscribeToNetworkStatus(listener: (status: NetworkStatus) => void): () => void {
  return NetInfo.addEventListener((state) => {
    listener(mapState(state));
  });
}

export function isOnline(status: NetworkStatus): boolean {
  return status.isConnected && status.isInternetReachable;
}
