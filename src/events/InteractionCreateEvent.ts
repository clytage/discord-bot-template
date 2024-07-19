import { Interaction, Message } from "discord.js";
import { BaseEvent } from "../structures/BaseEvent.js";
import { CommandContext } from "../structures/CommandContext.js";
import { Event } from "../utils/decorators/Event.js";
import { createEmbed } from "../utils/functions/createEmbed.js";

@Event("interactionCreate")
export class InteractionCreateEvent extends BaseEvent {
    public execute(interaction: Interaction): void {
        if (!interaction.inGuild()) return;

        const context = new CommandContext(interaction);
        if (interaction.isContextMenuCommand()) {
            const data = interaction.options.get("user") ??
                interaction.options.get("message");
            const cmd = this.client.commands.find(x => (
                data instanceof Message
                    ? x.meta.contextChat === interaction.commandName
                    : x.meta.contextUser === interaction.commandName
            ));

            if (cmd) {
                context.additionalArgs.set("options", data);
                void cmd.execute(context);
            }
        }

        if (interaction.isCommand()) {
            const cmd = this.client.commands
                .filter(x => x.meta.slash !== undefined)
                .find(x => x.meta.slash?.name === interaction.commandName);
            if (cmd) {
                void cmd.execute(context);
            }
        }

        if (interaction.isStringSelectMenu()) {
            const val = this.client.utils.decode(interaction.customId);
            const user = val.split("_")[0] ?? "";
            const cmd = val.split("_")[1] ?? "";
            const exec = (val.split("_")[2] ?? "yes") === "yes";

            if (interaction.user.id !== user) {
                void interaction.reply({
                    ephemeral: true,
                    embeds: [
                        createEmbed(
                            "error",
                            "Sorry, but this interaction is only for the message author.",
                            true
                        )
                    ]
                });
            }
            if (cmd && user === interaction.user.id && exec) {
                const command = this.client.commands
                    .filter(x => x.meta.slash !== undefined)
                    .find(x => x.meta.name === cmd);
                if (command) {
                    context.additionalArgs.set("values", interaction.values);
                    void command.execute(context);
                }
            }
        }
    }
}
