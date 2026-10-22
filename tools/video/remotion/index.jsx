import { Composition, registerRoot } from 'remotion'
import { Short, shortDuration } from './Short.jsx'

const Root = () => (
  <Composition
    id='Short'
    component={Short}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={{ timeline: null }}
    calculateMetadata={({ props }) => ({
      durationInFrames: props.timeline ? shortDuration(props.timeline) : 300,
      fps: props.timeline?.fps ?? 30
    })}
  />
)

registerRoot(Root)
