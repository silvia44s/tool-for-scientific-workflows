/**
 * @file App.tsx
 * @brief Root application component.
 *
 * This component serves as the top-level entry point of the UI.
 * It renders the workflow editor page, which contains the full
 * editor layout, state provider, and all interactive components.
 */
import { EditorPage } from '../features/workflow-editor/page/EditorPage';

export default function App() {
  return <EditorPage />;
}