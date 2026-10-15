// The measured anchors of the painted scenes: data/scene-anchors.json holds the same bytes as the app's
// shared/scene-anchors.json (written by flutter_app/tool/build_scenes.py). Never edit it by hand here;
// copy the app's file again. The scene test checks both stay equal when the app's worktree is present.
import anchors from '@/../data/scene-anchors.json';

export default anchors;
