import dotenv from "dotenv";
import {App} from "octokit";
import {createNodeMiddleware} from "@octokit/webhooks";
import fs from "fs";
import http from "http";

// This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.
dotenv.config();

// This assigns the values of your environment variables to local variables.
const appId = process.env.APP_ID;
const webhookSecret = process.env.WEBHOOK_SECRET;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;

// This reads the contents of your private key file.
const privateKey = fs.readFileSync(privateKeyPath, "utf8");

// This creates a new instance of the Octokit App class.
const app = new App({
    appId: appId,
    privateKey: privateKey,
    webhooks: {
        secret: webhookSecret
    },
});


let pendingStatusChecks = [];

async function completeStatusChecks(conclusion) {
    for (const check of pendingStatusChecks) {
        await check.octokit.rest.checks.update({
            owner: check.owner,
            repo: check.repo,
            check_run_id: check.id,
            conclusion: conclusion ? "success" : "failure",
        })
    }
    pendingStatusChecks = [];
}

const triggers = ["🍺", "🍻", "drunk"]

async function handleComment({octokit, payload}) {
    const body = payload.review.body.toLowerCase();

    const isSobrietyQuestioned = triggers.some(trigger => body.includes(trigger));
    if (!isSobrietyQuestioned) {
        return;
    }

    // Uh oh
    const result = await octokit.rest.checks.create({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        name: "Breathalyzer",
        status: "in_progress",
        head_sha: payload.pull_request.head.sha
    })

    pendingStatusChecks.push({
        octokit: octokit,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        id: result.data.id
    })

    setTimeout(() => {
        completeStatusChecks(true);
    }, 30000)

}


app.webhooks.on("pull_request_review", handleComment);

// This logs any errors that occur.
app.webhooks.onError((error) => {
    if (error.name === "AggregateError") {
        console.error(`Error processing request: ${error.event}`);
    } else {
        console.error(error);
    }
});

const port = process.env.PORT || 3000;
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const path = "/api/webhook";
const localWebhookUrl = `http://${host}:${port}${path}`;

// This sets up a middleware function to handle incoming webhook events.
//
// Octokit's `createNodeMiddleware` function takes care of generating this middleware function for you. The resulting middleware function will:
//
//    - Check the signature of the incoming webhook event to make sure that it matches your webhook secret. This verifies that the incoming webhook event is a valid GitHub event.
//    - Parse the webhook event payload and identify the type of event.
//    - Trigger the corresponding webhook event handler.
const middleware = createNodeMiddleware(app.webhooks, {path});

// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
http.createServer(middleware).listen(port, () => {
    console.log(`Server is listening for events at: ${localWebhookUrl}`);
    console.log('Press Ctrl + C to quit.')
});


setInterval(() => {
    console.log("Pending status checks", pendingStatusChecks.map(check => {
        return {
            owner: check.owner,
            repo: check.repo,
            id: check.id,
        }
    }))
}, 10000)
