from pathlib import Path
import posixpath
import paramiko

def _open_ssh_client(
    hostname: str,
    username: str,
    password: str | None = None,
    key_path: str | None = None,
    key_passphrase: str | None = None,
) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    if key_path:
        pkey = None
        key_file = str(Path(key_path).expanduser())

        # first try to load the key without passphrase, then with passphrase if needed
        key_errors = []

        for loader in (paramiko.Ed25519Key.from_private_key_file,
                       paramiko.RSAKey.from_private_key_file,
                       paramiko.ECDSAKey.from_private_key_file):
            try:
                pkey = loader(key_file, password=key_passphrase)
                break
            except Exception as e:
                key_errors.append(str(e))

        if pkey is None:
            raise RuntimeError(
                "Could not load private key. " + " | ".join(key_errors)
            )

        client.connect(
            hostname=hostname,
            username=username,
            pkey=pkey,
            timeout=15,
        )
    else:
        client.connect(
            hostname=hostname,
            username=username,
            password=password,
            timeout=15,
        )

    return client

def _sftp_mkdirs(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    parts = []
    current = remote_dir

    while current not in ("", "/"):
        parts.append(current)
        current = posixpath.dirname(current)

    for path in reversed(parts):
        try:
            sftp.stat(path)
        except FileNotFoundError:
            sftp.mkdir(path)

def _upload_dir(
    sftp: paramiko.SFTPClient,
    local_dir: Path,
    remote_dir: str,
) -> None:
    _sftp_mkdirs(sftp, remote_dir)

    for item in local_dir.iterdir():
        remote_item = posixpath.join(remote_dir, item.name)

        if item.is_dir():
            _upload_dir(sftp, item, remote_item)
        else:
            sftp.put(str(item), remote_item)