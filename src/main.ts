import "./style.css";
import { createSnakeExperience } from "./ui/app";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root");
}

createSnakeExperience(root);
