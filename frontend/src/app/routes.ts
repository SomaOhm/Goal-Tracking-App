import { createBrowserRouter } from "react-router";
import { Layout } from "./pages/Layout";
import { Home } from "./pages/Home";
import { CalendarView } from "./pages/CalendarView";
import { Groups } from "./pages/Groups";
import { Chat } from "./pages/Chat";
import { Profile } from "./pages/Profile";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "calendar", Component: CalendarView },
      { path: "groups", Component: Groups },
      { path: "chat", Component: Chat },
      { path: "profile", Component: Profile },
    ],
  },
]);
