import { Atom } from '../lib/atom'
import { FlamechartFrame } from '../lib/flamechart'
import { clamp, Rect, Vec2 } from '../lib/math'
import { Frame, Profile, ProfileGroup, CallTreeNode } from '../lib/profile'
import { objectsHaveShallowEquality } from '../lib/utils'
import { HoverNode } from '../types/types'
export type FlamechartFramePair = Readonly<[FlamechartFrame | null, FlamechartFrame | null]>
export interface FlamechartViewState {
  hover: HoverNode | null
  selectedNode: CallTreeNode | null
  selectedFrames: FlamechartFramePair | null
  logicalSpaceViewportSize: Vec2
  configSpaceViewportRect: Rect
}

export interface CallerCalleeState {
  selectedFrame: Frame
  invertedCallerFlamegraph: FlamechartViewState
  calleeFlamegraph: FlamechartViewState
}

export interface SandwichViewState {
  callerCallee: CallerCalleeState | null
}

export interface ProfileState {
  profile: Profile
  chronoViewState: FlamechartViewState
  leftHeavyViewState: FlamechartViewState
  sandwichViewState: SandwichViewState
}

export type ProfileGroupState = {
  name: string

  // The index within the list of profiles currently being viewed
  indexToView: number

  profiles: ProfileState[]
} | null

export enum FlamechartID {
  LEFT_HEAVY = 'LEFT_HEAVY',
  CHRONO = 'CHRONO',
  SANDWICH_INVERTED_CALLERS = 'SANDWICH_INVERTED_CALLERS',
  SANDWICH_CALLEES = 'SANDWICH_CALLEES',
}

let initialFlameChartViewState: FlamechartViewState = {
  hover: null,
  selectedNode: null,
  selectedFrames: null,
  configSpaceViewportRect: Rect.empty,
  logicalSpaceViewportSize: Vec2.zero,
}

export class ProfileGroupAtom extends Atom<ProfileGroupState> {
  set(newState: ProfileGroupState) {
    const oldState = this.state
    if (oldState != null && newState != null && objectsHaveShallowEquality(oldState, newState)) {
      return
    }
    super.set(newState)
  }

  getActiveProfile(): ProfileState | null {
    if (this.state == null) return null
    return this.state.profiles[this.state?.indexToView] || null
  }

  setProfileGroup = (group: ProfileGroup) => {
    this.set({
      name: group.name,
      indexToView: group.indexToView,
      profiles: group.profiles.map(p => ({
        profile: p,
        chronoViewState: initialFlameChartViewState,
        leftHeavyViewState: initialFlameChartViewState,
        sandwichViewState: { callerCallee: null },
      })),
    })
  }

  setProfileIndexToView = (indexToView: number) => {
    if (this.state == null) return

    indexToView = clamp(indexToView, 0, this.state.profiles.length - 1)

    this.set({
      ...this.state,
      indexToView,
    })
  }

  private updateActiveProfileState(fn: (profileState: ProfileState) => ProfileState) {
    if (this.state == null) return
    const { indexToView, profiles } = this.state
    this.set({
      ...this.state,
      profiles: profiles.map((p, i) => {
        if (i != indexToView) return p
        return fn(p)
      }),
    })
  }

  private updateActiveSandwichViewState(
    fn: (sandwichViewState: SandwichViewState) => SandwichViewState,
  ) {
    this.updateActiveProfileState(p => ({
      ...p,
      sandwichViewState: fn(p.sandwichViewState),
    }))
  }

  setSelectedFrame = (frame: Frame | null) => {
    if (this.state == null) return

    const profile = this.getActiveProfile()
    if (profile == null) {
      return
    }

    this.updateActiveSandwichViewState(sandwichViewState => {
      if (frame == null) {
        return { callerCallee: null }
      }
      return {
        callerCallee: {
          invertedCallerFlamegraph: initialFlameChartViewState,
          calleeFlamegraph: initialFlameChartViewState,
          selectedFrame: frame,
        },
      }
    })
  }

  private updateFlamechartState(
    id: FlamechartID,
    fn: (flamechartViewState: FlamechartViewState) => FlamechartViewState,
  ) {
    switch (id) {
      case FlamechartID.CHRONO: {
        this.updateActiveProfileState(p => ({
          ...p,
          chronoViewState: fn(p.chronoViewState),
        }))
        break
      }

      case FlamechartID.LEFT_HEAVY: {
        this.updateActiveProfileState(p => ({
          ...p,
          leftHeavyViewState: fn(p.leftHeavyViewState),
        }))
        break
      }

      case FlamechartID.SANDWICH_CALLEES: {
        this.updateActiveSandwichViewState(s => ({
          ...s,
          callerCallee:
            s.callerCallee == null
              ? null
              : {
                ...s.callerCallee,
                calleeFlamegraph: fn(s.callerCallee.calleeFlamegraph),
              },
        }))
        break
      }

      case FlamechartID.SANDWICH_INVERTED_CALLERS: {
        this.updateActiveSandwichViewState(s => ({
          ...s,
          callerCallee:
            s.callerCallee == null
              ? null
              : {
                ...s.callerCallee,
                invertedCallerFlamegraph: fn(s.callerCallee.invertedCallerFlamegraph),
              },
        }))
        break
      }
    }
  }

  setFlamechartHoveredNode(
    id: FlamechartID,
    hover: HoverNode | null,
  ) {
    this.updateFlamechartState(id, f => ({
      ...f,
      hover,
    }))
  }

  setSelectedNode(id: FlamechartID, selectedNode: CallTreeNode | null) {
    this.updateFlamechartState(id, f => ({
      ...f,
      selectedNode,
    }))
  }

  setSelectedFrames(id: FlamechartID, selectedFrames: FlamechartFramePair | null) {
    this.updateFlamechartState(id, f => ({
      ...f,
      selectedFrames,
    }))
  }

  setConfigSpaceViewportRect(id: FlamechartID, configSpaceViewportRect: Rect) {
    this.updateFlamechartState(id, f => ({
      ...f,
      configSpaceViewportRect,
    }))
  }

  setLogicalSpaceViewportSize(id: FlamechartID, logicalSpaceViewportSize: Vec2) {
    this.updateFlamechartState(id, f => ({
      ...f,
      logicalSpaceViewportSize,
    }))
  }

  clearHoverNode() {
    // TODO(jlfwong): This causes 4 separate observer events. This is probably
    // fine, since I hope that Preact/React are smart about batching re-renders?
    this.setFlamechartHoveredNode(FlamechartID.CHRONO, null)
    this.setFlamechartHoveredNode(FlamechartID.LEFT_HEAVY, null)
    this.setFlamechartHoveredNode(FlamechartID.SANDWICH_CALLEES, null)
    this.setFlamechartHoveredNode(FlamechartID.SANDWICH_INVERTED_CALLERS, null)
  }
}
