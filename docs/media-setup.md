# Setting up pictures

Pictures are optional. The game plays in text without them, and a missing
picture fails soft: a placeholder stands in and the table plays on. Set up
only what you want.

Everything here is done once by the server's admin, in **Admin** (the account
menu, top right). Players never touch it.

| You want | Easiest route | Needs |
|---|---|---|
| Pictures (portraits, scene art, maps) | ComfyUI on the same machine | a GPU, a checkpoint file |
| Pictures with no GPU | an OpenAI key | an OpenAI account (paid per picture) |

## Pictures with ComfyUI

1. **Install ComfyUI.** Follow the install for your system in the
   [ComfyUI README](https://github.com/comfyanonymous/ComfyUI#installing). The
   desktop installer and the portable Windows build both work; so does a
   manual install:

   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI
   cd ComfyUI
   python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt
   ```

   Install the PyTorch build for your GPU first if the ComfyUI README says to.

2. **Give it a checkpoint.** Put one checkpoint file (`.safetensors`) in
   `ComfyUI/models/checkpoints/`. Any checkpoint works; an SDXL-class one suits
   the sizes the game asks for (1024 to 1344 on the long side). The campaign's
   genre supplies the art style, so a general-purpose checkpoint is the right
   pick.

3. **Start it.**

   ```bash
   python main.py --listen 127.0.0.1 --port 8188
   ```

   Open `http://127.0.0.1:8188` in a browser to confirm it is up. If Open
   Dungeon Master runs in Docker, or on another machine, start ComfyUI with
   `--listen 0.0.0.0` so it can be reached from outside its own machine.

4. **Point the server at it.** In **Admin > Image generation**:
   - **Default backend**: ComfyUI (local)
   - **Server URL**: `http://127.0.0.1:8188` (in Docker:
     `http://host.docker.internal:8188`, which is the compose file's default)
   - **Checkpoint (model file)**: pick yours from the list, or leave it on
     Auto to use the first one

   Save. New characters get a portrait, scenes get art, and fights get a
   painted map.

Things to know:

- Pictures run one at a time on a shared queue. On a machine where the DM
  model and the image model share memory, that is what keeps a picture from
  stalling a turn.
- ComfyUI must be running whenever you want pictures. Nothing breaks when it is
  not; the placeholder has a Generate button that works once it is back.
- The other backends (the FLUX worker, OpenAI) are covered in
  [image-generation.md](image-generation.md).

## Pictures with an OpenAI key (no GPU)

In **Admin > Image generation** choose **OpenAI-compatible images API** as the default backend and
paste a key. If the story's text model already runs on OpenAI, the same key
covers pictures and you can leave the field empty. Each picture is billed to
that key.

## In Docker

Inside a container `127.0.0.1` is the container itself, so the compose file
points every service at `host.docker.internal` instead. Two things follow:

- Start ComfyUI so it listens beyond loopback (`--listen 0.0.0.0`).
- If you type an address into Admin, use `host.docker.internal`, not
  `127.0.0.1`.

## When it does not work

- **No pictures, only placeholders.** Open the ComfyUI address in a browser
  from the machine the server runs on. If it does not load there, the server
  cannot reach it either. Then check that the checkpoint list in **Admin >
  Image generation** is not empty.

Every setting here also has an environment variable, listed in
[configuration.md](configuration.md). A value saved in Admin wins over the
environment.
