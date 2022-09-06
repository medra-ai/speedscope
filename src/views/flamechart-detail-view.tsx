import { StyleDeclarationValue, css } from 'aphrodite'
import { h, JSX } from 'preact'
import { getFlamechartStyle } from './flamechart-style'
import { formatPercent } from '../lib/utils'
import { Frame, CallTreeNode } from '../lib/profile'
import { ColorChit } from './color-chit'
import { Flamechart, FlamechartFrame } from '../lib/flamechart'
import { useTheme } from './themes/theme'
import { FlamechartFramePair } from '../app-state/profile-group'

interface StatisticsTableProps {
  title: string
  grandTotal: number
  selectedTotal: number
  selectedSelf: number
  cellStyle: StyleDeclarationValue
  formatter: (v: number) => string
}

function StatisticsTable(props: StatisticsTableProps) {
  const style = getFlamechartStyle(useTheme())

  const total = props.formatter(props.selectedTotal)
  const self = props.formatter(props.selectedSelf)
  const totalPerc = (100.0 * props.selectedTotal) / props.grandTotal
  const selfPerc = (100.0 * props.selectedSelf) / props.grandTotal

  return (
    <div className={css(style.statsTable)}>
      <div className={css(props.cellStyle, style.statsTableCell, style.statsTableHeader)}>
        {props.title}
      </div>

      <div className={css(props.cellStyle, style.statsTableCell)}>Total</div>
      <div className={css(props.cellStyle, style.statsTableCell)}>Self</div>

      <div className={css(props.cellStyle, style.statsTableCell)}>{total}</div>
      <div className={css(props.cellStyle, style.statsTableCell)}>{self}</div>

      <div className={css(props.cellStyle, style.statsTableCell)}>
        {formatPercent(totalPerc)}
        <div className={css(style.barDisplay)} style={{ height: `${totalPerc}%` }} />
      </div>
      <div className={css(props.cellStyle, style.statsTableCell)}>
        {formatPercent(selfPerc)}
        <div className={css(style.barDisplay)} style={{ height: `${selfPerc}%` }} />
      </div>
    </div>
  )
}

type FullFlamechartFramePair = Readonly<[FlamechartFrame, FlamechartFrame]>

const isFull = (pair: FlamechartFramePair): pair is FullFlamechartFramePair => {
  return pair[0] !== null && pair[1] !== null
}

interface TimingsTableProps {
  frames: FullFlamechartFramePair
  formatter: (v: number) => string
  grandTotal: number
  cellStyle: StyleDeclarationValue
}

function TimingsTable(props: TimingsTableProps) {
  const style = getFlamechartStyle(useTheme())
  const start2start = props.frames[1].start - props.frames[0].start
  // const start2end = 0;
  // const end2start = 0;
  const end2end = props.frames[1].end - props.frames[0].end

  const startToStart = props.formatter(start2start)
  const endToEnd = props.formatter(end2end)
  const s2sPerc = (100.0 * start2start) / props.grandTotal
  const e2ePerc = (100.0 * end2end) / props.grandTotal

  return (
    <div className={css(style.statsTable)}>
      <div className={css(props.cellStyle, style.statsTableCell, style.statsTableHeader)}>
        Timings
      </div>

      <div className={css(props.cellStyle, style.statsTableCell)}>Start to Start</div>
      <div className={css(props.cellStyle, style.statsTableCell)}>End to End</div>

      <div className={css(props.cellStyle, style.statsTableCell)}>{startToStart}</div>
      <div className={css(props.cellStyle, style.statsTableCell)}>{endToEnd}</div>

      <div className={css(props.cellStyle, style.statsTableCell)}>
        {formatPercent(s2sPerc)}
        <div className={css(style.barDisplay)} style={{ height: `${s2sPerc}%` }} />
      </div>
      <div className={css(props.cellStyle, style.statsTableCell)}>
        {formatPercent(e2ePerc)}
        <div className={css(style.barDisplay)} style={{ height: `${e2ePerc}%` }} />
      </div>
    </div>
  )
}

interface StackTraceViewProps {
  getFrameColor: (frame: Frame) => string
  node: CallTreeNode
}
function StackTraceView(props: StackTraceViewProps) {
  const style = getFlamechartStyle(useTheme())

  const rows: JSX.Element[] = []
  let node: CallTreeNode | null = props.node
  for (; node && !node.isRoot(); node = node.parent) {
    const row: (JSX.Element | string)[] = []
    const { frame } = node

    row.push(<ColorChit color={props.getFrameColor(frame)} />)

    if (rows.length) {
      row.push(<span className={css(style.stackFileLine)}>&gt; </span>)
    }
    row.push(frame.name)

    if (frame.file) {
      let pos = frame.file
      if (frame.line != null) {
        pos += `:${frame.line}`
        if (frame.col != null) {
          pos += `:${frame.col}`
        }
      }
      row.push(<span className={css(style.stackFileLine)}> ({pos})</span>)
    }
    rows.push(<div className={css(style.stackLine)}>{row}</div>)
  }
  return (
    <div className={css(style.stackTraceView)}>
      <div className={css(style.stackTraceViewPadding)}>{rows}</div>
    </div>
  )
}

interface FlamechartDetailViewProps {
  flamechart: Flamechart
  getCSSColorForFrame: (frame: Frame) => string
  selectedNode: CallTreeNode
  selectedFrames: FlamechartFramePair | null
}

export function FlamechartDetailView(props: FlamechartDetailViewProps) {
  const style = getFlamechartStyle(useTheme())

  const { flamechart, selectedNode } = props
  const { frame } = selectedNode

  return (
    <div className={css(style.detailView)}>
      <StatisticsTable
        title={'This Instance'}
        cellStyle={style.thisInstanceCell}
        grandTotal={flamechart.getTotalWeight()}
        selectedTotal={selectedNode.getTotalWeight()}
        selectedSelf={selectedNode.getSelfWeight()}
        formatter={flamechart.formatValue.bind(flamechart)}
      />
      <StatisticsTable
        title={'All Instances'}
        cellStyle={style.allInstancesCell}
        grandTotal={flamechart.getTotalWeight()}
        selectedTotal={frame.getTotalWeight()}
        selectedSelf={frame.getSelfWeight()}
        formatter={flamechart.formatValue.bind(flamechart)}
      />
      {
        props.selectedFrames && isFull(props.selectedFrames) && <TimingsTable
          frames={props.selectedFrames}
          cellStyle={style.allInstancesCell}
          grandTotal={flamechart.getTotalWeight()}
          formatter={flamechart.formatValue.bind(flamechart)}
        />
      }

      <StackTraceView node={selectedNode} getFrameColor={props.getCSSColorForFrame} />
    </div>
  )
}
