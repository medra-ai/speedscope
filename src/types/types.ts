import { CallTreeNode } from '../lib/profile'
import { FlamechartFrame } from '../lib/flamechart'
export interface HoverNode { node: CallTreeNode; event: MouseEvent; frame: FlamechartFrame }
