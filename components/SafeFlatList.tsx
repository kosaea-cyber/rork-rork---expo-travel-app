import React, { useMemo } from 'react';
import { FlatList, FlatListProps } from 'react-native';
import { log } from '@/lib/utils/log';

type WindowingDefaults = {
  initialNumToRender: number;
  maxToRenderPerBatch: number;
  windowSize: number;
  updateCellsBatchingPeriod: number;
  removeClippedSubviews: boolean;
};

const DEFAULTS: WindowingDefaults = {
  initialNumToRender: 10,
  maxToRenderPerBatch: 10,
  windowSize: 7,
  updateCellsBatchingPeriod: 50,
  removeClippedSubviews: true,
};

export type SafeFlatListProps<ItemT> = FlatListProps<ItemT> & {
  performanceGuardName?: string;
};

export function SafeFlatList<ItemT>(props: SafeFlatListProps<ItemT>) {
  const { data, performanceGuardName, ...rest } = props;

  const guardedProps = useMemo(() => {
    const length = Array.isArray(data) ? data.length : 0;

    if (__DEV__ && length > 200) {
      log.warn('[SafeFlatList] large list rendered', {
        name: performanceGuardName ?? 'unknown',
        length,
      });
    }

    return {
      initialNumToRender: props.initialNumToRender ?? DEFAULTS.initialNumToRender,
      maxToRenderPerBatch: props.maxToRenderPerBatch ?? DEFAULTS.maxToRenderPerBatch,
      windowSize: props.windowSize ?? DEFAULTS.windowSize,
      updateCellsBatchingPeriod:
        props.updateCellsBatchingPeriod ?? DEFAULTS.updateCellsBatchingPeriod,
      removeClippedSubviews: props.removeClippedSubviews ?? DEFAULTS.removeClippedSubviews,
    } as const;
  }, [
    data,
    performanceGuardName,
    props.initialNumToRender,
    props.maxToRenderPerBatch,
    props.windowSize,
    props.updateCellsBatchingPeriod,
    props.removeClippedSubviews,
  ]);

  return <FlatList data={data} {...guardedProps} {...rest} />;
}
