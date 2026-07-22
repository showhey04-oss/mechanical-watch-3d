export const MAX_ESCAPEMENT_AUDIO_RATE = 8;
export const MAX_PHASE_EVENTS_PER_FRAME = 1;

const finiteIndex = (value) => Number.isFinite(value) ? Math.trunc(value) : null;

export function createAudioEventState(snapshot = {}) {
  return {
    escapementBeatIndex: finiteIndex(snapshot.escapementBeatIndex),
    windingToothIndex: finiteIndex(snapshot.windingToothIndex),
    reverseToothIndex: finiteIndex(snapshot.reverseToothIndex),
  };
}

function phaseCrossings(previous, current) {
  if (previous === null || current === null) return 0;
  return Math.abs(current - previous);
}

export function resolveMechanicalAudioEvents(previousState, snapshot = {}) {
  const previous = previousState ?? createAudioEventState();
  const nextState = createAudioEventState(snapshot);
  const events = [];
  let droppedEvents = 0;
  let suppressedEvents = 0;
  const available = snapshot.audioEnabled === true && snapshot.visible !== false;

  const previousBeat = finiteIndex(previous.escapementBeatIndex);
  const currentBeat = nextState.escapementBeatIndex;
  if (previousBeat !== null && currentBeat !== null && currentBeat > previousBeat) {
    const crossed = currentBeat - previousBeat;
    if (snapshot.activeOscillation && available) {
      const beatRate = Math.max(0, Number(snapshot.escapementBeatRate) || 0);
      const thinningStride = Math.max(1, Math.ceil(beatRate / MAX_ESCAPEMENT_AUDIO_RATE));
      droppedEvents += Math.max(0, crossed - 1);
      if (currentBeat % thinningStride === 0) {
        events.push(currentBeat % 2 === 0 ? "escapementTick" : "escapementTock");
      } else {
        suppressedEvents += 1;
      }
    } else if (snapshot.activeOscillation && snapshot.audioEnabled === true) {
      suppressedEvents += crossed;
    }
  }

  const windingCrossings = phaseCrossings(
    finiteIndex(previous.windingToothIndex),
    nextState.windingToothIndex,
  );
  const reverseCrossings = phaseCrossings(
    finiteIndex(previous.reverseToothIndex),
    nextState.reverseToothIndex,
  );
  if (snapshot.crownPosition === "wind" && snapshot.ratchetMode === "engaged" && windingCrossings > 0) {
    if (available) events.push("winding");
    else if (snapshot.audioEnabled === true) suppressedEvents += windingCrossings;
    if (snapshot.audioEnabled === true) droppedEvents += Math.max(0, windingCrossings - MAX_PHASE_EVENTS_PER_FRAME);
  } else if (snapshot.crownPosition === "wind" && snapshot.ratchetMode === "freewheel" && reverseCrossings > 0) {
    if (available) events.push("reverse");
    else if (snapshot.audioEnabled === true) suppressedEvents += reverseCrossings;
    if (snapshot.audioEnabled === true) droppedEvents += Math.max(0, reverseCrossings - MAX_PHASE_EVENTS_PER_FRAME);
  }

  if (snapshot.crownEndpointEvent) {
    if (available) events.push(snapshot.crownEndpointEvent);
    else if (snapshot.audioEnabled === true) suppressedEvents += 1;
  }

  return { state: nextState, events, droppedEvents, suppressedEvents };
}
