import { Config } from "@remotion/cli/config";

// CPU / SwiftShader-friendly GL backend for headless render on a GPU-less box.
// (Also passed on the CLI as --gl=angle; setting here keeps `remotion studio` consistent.)
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
