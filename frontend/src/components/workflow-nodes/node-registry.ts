import type { ComponentType } from "react";
import { ImageToImageNode } from "./ai/image-to-image-node";
import { ImageToVideoNode } from "./ai/image-to-video-node";
import { MultiImageToImageNode } from "./ai/multi-image-to-image-node";
import { MultimodalToTextNode } from "./ai/multimodal-to-text-node";
import { MusicGenerationNode } from "./ai/music-generation-node";
import { SpeechToTextNode } from "./ai/speech-to-text-node";
import { TextToImageNode } from "./ai/text-to-image-node";
import { TextToSpeechNode } from "./ai/text-to-speech-node";
import { TextToVideoNode } from "./ai/text-to-video-node";
import { AudioInputNode } from "./input/audio-input-node";
import { ImageInputNode } from "./input/image-input-node";
import { TextInputNode } from "./input/text-input-node";
import { VideoInputNode } from "./input/video-input-node";
import type { WorkflowNodeComponentProps } from "./types";

export const workflowNodeRegistry: Record<string, ComponentType<WorkflowNodeComponentProps>> = {
  "input.text": TextInputNode,
  "input.image": ImageInputNode,
  "input.audio": AudioInputNode,
  "input.video": VideoInputNode,
  "ai.speech-to-text": SpeechToTextNode,
  "ai.multimodal-to-text": MultimodalToTextNode,
  "ai.image-to-image": ImageToImageNode,
  "ai.multi-image-to-image": MultiImageToImageNode,
  "ai.text-to-image": TextToImageNode,
  "ai.music-generation": MusicGenerationNode,
  "ai.text-to-speech": TextToSpeechNode,
  "ai.text-to-video": TextToVideoNode,
  "ai.image-to-video": ImageToVideoNode,
};

