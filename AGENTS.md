<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## MCP (Model Context Protocol) Configuration

This project and environment use the following MCP Servers:
- **appflowy**: Local Node.js server (`C:\tmp\appflowy-mcp\dist\index.js`) for Appflowy note-taking & knowledge base sync.
- **omniroute**: Multi-provider routing tool via `npx omniroute mcp`.
- **skills**: `@anthropic/skills-mcp` for agent workflow skills.

### Config Files Managed:
1. **Claude Desktop**: `C:\Users\Administrator\AppData\Roaming\Claude\claude_desktop_config.json`
2. **Claude Code / Claude CLI / Project Root**: [.mcp.json](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/.mcp.json)
3. **Cursor IDE**: [.cursor/mcp.json](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/.cursor/mcp.json)
4. **VS Code (Cline / Roo Code)**: `C:\Users\Administrator\AppData\Roaming\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

