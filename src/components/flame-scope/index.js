/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// @flow
import * as React from 'react';
import {
  TIMELINE_MARGIN_RIGHT,
  JS_TRACER_MAXIMUM_CHART_ZOOM,
} from '../../app-logic/constants';
import explicitConnect from '../../utils/connect';
import { FlameScopeCanvas } from './Canvas';
import {
  getCommittedRange,
  getProfileInterval,
  getPreviewSelection,
  getScrollToSelectionGeneration,
  getCategories,
  getPageList,
} from '../../selectors/profile';
import { selectedThreadSelectors } from '../../selectors/per-thread';
import {
  getShowUserTimings,
  getSelectedThreadsKey,
} from '../../selectors/url-state';
import { getTimelineMarginLeft } from '../../selectors/app';
import { StackChartEmptyReasons } from './StackChartEmptyReasons';
import { ContextMenuTrigger } from '../shared/ContextMenuTrigger';
import { StackSettings } from '../shared/StackSettings';
import { TransformNavigator } from '../shared/TransformNavigator';
import {
  updatePreviewSelection,
  changeSelectedCallNode,
  changeRightClickedCallNode,
  handleCallNodeTransformShortcut,
} from '../../actions/profile-view';

import { getCallNodePathFromIndex } from '../../profile-logic/profile-data';

import type {
  Thread,
  CategoryList,
  PageList,
  CallNodeInfo,
  IndexIntoCallNodeTable,
  CombinedTimingRows,
  MarkerIndex,
  Marker,
  Milliseconds,
  UnitIntervalOfProfileRange,
  StartEndRange,
  PreviewSelection,
  WeightType,
  ThreadsKey,
  CssPixels,
} from 'firefox-profiler/types';

import type { ConnectedProps } from '../../utils/connect';

import './index.css';

const STACK_FRAME_HEIGHT = 16;

type StateProps = {|
  +thread: Thread,
  +weightType: WeightType,
  +pages: PageList | null,
  +maxStackDepth: number,
  +combinedTimingRows: CombinedTimingRows,
  +timeRange: StartEndRange,
  +interval: Milliseconds,
  +previewSelection: PreviewSelection,
  +threadsKey: ThreadsKey,
  +callNodeInfo: CallNodeInfo,
  +categories: CategoryList,
  +selectedCallNodeIndex: IndexIntoCallNodeTable | null,
  +rightClickedCallNodeIndex: IndexIntoCallNodeTable | null,
  +scrollToSelectionGeneration: number,
  +getMarker: (MarkerIndex) => Marker,
  +userTimings: MarkerIndex[],
  +timelineMarginLeft: CssPixels,
|};

type DispatchProps = {|
  +changeSelectedCallNode: typeof changeSelectedCallNode,
  +changeRightClickedCallNode: typeof changeRightClickedCallNode,
  +updatePreviewSelection: typeof updatePreviewSelection,
  +handleCallNodeTransformShortcut: typeof handleCallNodeTransformShortcut,
|};

type Props = ConnectedProps<{||}, StateProps, DispatchProps>;

class FlameScopeImpl extends React.PureComponent<Props> {
  _viewport: HTMLDivElement | null = null;
  /**
   * Determine the maximum amount available to zoom in.
   */
  getMaximumZoom(): UnitIntervalOfProfileRange {
    const {
      timeRange: { start, end },
      interval,
      thread,
    } = this.props;
    // JS Tracer does not care about the interval.
    const modifier = thread.jsTracer ? JS_TRACER_MAXIMUM_CHART_ZOOM : interval;
    return modifier / (end - start);
  }

  _onSelectedCallNodeChange = (
    callNodeIndex: IndexIntoCallNodeTable | null
  ) => {
    const { callNodeInfo, threadsKey, changeSelectedCallNode } = this.props;
    changeSelectedCallNode(
      threadsKey,
      getCallNodePathFromIndex(callNodeIndex, callNodeInfo.callNodeTable)
    );
  };

  _onRightClickedCallNodeChange = (callNodeIndex: number | null) => {
    const { callNodeInfo, threadsKey, changeRightClickedCallNode } = this.props;

    changeRightClickedCallNode(
      threadsKey,
      getCallNodePathFromIndex(callNodeIndex, callNodeInfo.callNodeTable)
    );
  };

  _shouldDisplayTooltips = () => this.props.rightClickedCallNodeIndex === null;

  _takeViewportRef = (viewport: HTMLDivElement | null) => {
    this._viewport = viewport;
  };

  _focusViewport = () => {
    if (this._viewport) {
      this._viewport.focus();
    }
  };

  _handleKeyDown = (event: SyntheticKeyboardEvent<HTMLElement>) => {
    const {
      threadsKey,
      selectedCallNodeIndex,
      rightClickedCallNodeIndex,
      handleCallNodeTransformShortcut,
    } = this.props;

    const nodeIndex =
      rightClickedCallNodeIndex !== null
        ? rightClickedCallNodeIndex
        : selectedCallNodeIndex;
    if (nodeIndex === null) {
      return;
    }
    handleCallNodeTransformShortcut(event, threadsKey, nodeIndex);
  };

  componentDidMount() {
    this._focusViewport();
  }

  render() {
    const {
      thread,
      threadsKey,
      maxStackDepth,
      combinedTimingRows,
      timeRange,
      interval,
      previewSelection,
      updatePreviewSelection,
      callNodeInfo,
      categories,
      selectedCallNodeIndex,
      scrollToSelectionGeneration,
      pages,
      getMarker,
      userTimings,
      weightType,
      timelineMarginLeft,
    } = this.props;

    const maxViewportHeight = maxStackDepth * STACK_FRAME_HEIGHT;

    return (
      <div
        className="stackChart"
        id="stack-chart-tab"
        role="tabpanel"
        aria-labelledby="stack-chart-tab-button"
        onKeyDown={this._handleKeyDown}
      >
        <div>Flame Scope!</div>
        <StackSettings />
        <TransformNavigator />
        {maxStackDepth === 0 && userTimings.length === 0 ? (
          <StackChartEmptyReasons />
        ) : (
          <ContextMenuTrigger
            id="CallNodeContextMenu"
            attributes={{
              className: 'treeViewContextMenu',
            }}
          >
            <div className="stackChartContent">
              <FlameScopeCanvas
                viewportProps={{
                  previewSelection,
                  timeRange,
                  maxViewportHeight,
                  viewportNeedsUpdate,
                  marginLeft: timelineMarginLeft,
                  marginRight: TIMELINE_MARGIN_RIGHT,
                  maximumZoom: this.getMaximumZoom(),
                  containerRef: this._takeViewportRef,
                }}
                chartProps={{
                  interval,
                  thread,
                  weightType,
                  pages,
                  threadsKey,
                  combinedTimingRows,
                  getMarker,
                  // $FlowFixMe Error introduced by upgrading to v0.96.0. See issue #1936.
                  updatePreviewSelection,
                  rangeStart: timeRange.start,
                  rangeEnd: timeRange.end,
                  stackFrameHeight: STACK_FRAME_HEIGHT,
                  callNodeInfo,
                  categories,
                  selectedCallNodeIndex,
                  onSelectionChange: this._onSelectedCallNodeChange,
                  // TODO: support right clicking user timing markers #2354.
                  onRightClick: this._onRightClickedCallNodeChange,
                  shouldDisplayTooltips: this._shouldDisplayTooltips,
                  scrollToSelectionGeneration,
                  marginLeft: timelineMarginLeft,
                }}
              />
            </div>
          </ContextMenuTrigger>
        )}
      </div>
    );
  }
}

export const FlameScope = explicitConnect<{||}, StateProps, DispatchProps>({
  mapStateToProps: (state) => {
    const showUserTimings = getShowUserTimings(state);
    const combinedTimingRows = showUserTimings
      ? selectedThreadSelectors.getCombinedTimingRows(state)
      : selectedThreadSelectors.getStackTimingByDepth(state);

    return {
      thread: selectedThreadSelectors.getFilteredThread(state),
      // Use the raw WeightType here, as the stack chart does not use the call tree
      weightType: selectedThreadSelectors.getSamplesWeightType(state),
      maxStackDepth: selectedThreadSelectors.getFilteredCallNodeMaxDepth(state),
      combinedTimingRows,
      timeRange: getCommittedRange(state),
      interval: getProfileInterval(state),
      previewSelection: getPreviewSelection(state),
      threadsKey: getSelectedThreadsKey(state),
      callNodeInfo: selectedThreadSelectors.getCallNodeInfo(state),
      categories: getCategories(state),
      selectedCallNodeIndex:
        selectedThreadSelectors.getSelectedCallNodeIndex(state),
      rightClickedCallNodeIndex:
        selectedThreadSelectors.getRightClickedCallNodeIndex(state),
      scrollToSelectionGeneration: getScrollToSelectionGeneration(state),
      pages: getPageList(state),
      getMarker: selectedThreadSelectors.getMarkerGetter(state),
      userTimings: selectedThreadSelectors.getUserTimingMarkerIndexes(state),
      timelineMarginLeft: getTimelineMarginLeft(state),
    };
  },
  mapDispatchToProps: {
    changeSelectedCallNode,
    changeRightClickedCallNode,
    updatePreviewSelection,
    handleCallNodeTransformShortcut,
  },
  component: FlameScopeImpl,
});

// This function is given the FlameScopeCanvas's chartProps.
function viewportNeedsUpdate(
  prevProps: { +combinedTimingRows: CombinedTimingRows },
  newProps: { +combinedTimingRows: CombinedTimingRows }
) {
  return prevProps.combinedTimingRows !== newProps.combinedTimingRows;
}
