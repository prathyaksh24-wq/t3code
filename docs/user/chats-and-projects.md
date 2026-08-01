# Chats and projects

T3 Code opens new chats in **General chats** by default. A general chat is not attached to one of your visible projects, so you can ask a question or start a task before choosing a repository.

## Attach a new chat to a project

On the new-chat screen, choose **Attach a project** before sending the first message. The chat then starts in that project's workspace.

## Move an existing chat

Open the chat's context menu in the sidebar, choose **Move to project**, and select a project or **General chats**.

Moving keeps the chat's messages and turn history. Workspace-bound state cannot move safely between directories, so T3 Code stops the provider session and terminal and clears the chat's branch, worktree, and code checkpoints. The next message starts a fresh provider session in the destination workspace.

A chat cannot move while its provider is starting or running. Stop the active work first, then move it.
