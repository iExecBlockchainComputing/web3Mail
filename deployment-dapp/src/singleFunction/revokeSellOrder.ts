import { IExec } from 'iexec';
import { DEFAULT_APP_PRICE, DEFAULT_APP_VOLUME } from '../config/config.js';
import { isUndefined } from '../utils/validator.js';

export const revokeSellOrder = async (
  iexec: IExec,
  appAddress: string,
  price?: string,
  volume?: string
): Promise<string> => {
  const appPrice = isUndefined(price)
    ? DEFAULT_APP_PRICE
    : parseInt(price) * 10e9;
  const appVolume = isUndefined(volume) ? DEFAULT_APP_VOLUME : parseInt(volume);
  console.log(
    `Revoking apporder for app ${appAddress} with price ${appPrice} and volume ${appVolume}`
  );

  const appOrders = await iexec.orderbook.fetchAppOrderbook(appAddress);
  const orderHash = appOrders?.orders.find(
    (o) => o.order.appprice === appPrice && o.order.volume === appVolume
  )?.orderHash;

  if (!orderHash) throw Error('No corresponding appOrder found');
  const txHash = await iexec.order.unpublishApporder(orderHash);
  console.log(`Revoked apporder ${orderHash}\n${txHash}`);
  return txHash;
};
