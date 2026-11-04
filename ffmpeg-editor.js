
/* PROFESSIONAL VIDEO TRIMMER */

.trim-box {
    background: #151515;
    border: 1px solid rgba(216,173,85,.2);
    border-radius: 16px;
    padding: 25px;
}

.trim-upload {
    padding: 20px;
    border: 1px dashed #80652f;
    border-radius: 12px;
    text-align: center;
}

.trim-upload h3 {
    color: #f4d58a;
    margin-bottom: 15px;
}

.trim-upload input {
    max-width: 100%;
    color: #ddd;
}

.trim-upload p,
#trimStatus {
    color: #999;
    font-size: 12px;
    margin-top: 12px;
}

.trim-preview {
    margin-top: 20px;
    background: #080808;
    border-radius: 10px;
    overflow: hidden;
}

.trim-preview video {
    display: block;
    width: 100%;
    max-height: 350px;
}

.trim-settings {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-top: 22px;
}

.trim-settings label {
    display: block;
    color: #d8ad55;
    font-size: 12px;
    margin-bottom: 8px;
}

.trim-settings input {
    width: 100%;
    padding: 12px;
    background: #090909;
    border: 1px solid #40331c;
    border-radius: 8px;
    color: white;
    font-family: inherit;
}

.trim-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 22px;
}

.trim-actions button {
    padding: 12px 18px;
    border: 1px solid #b58b42;
    border-radius: 8px;
    background: #d8ad55;
    color: #111;
    font-weight: bold;
    font-family: inherit;
}

.trim-actions button:disabled {
    opacity: .4;
    cursor: not-allowed;
}

.trim-progress {
    height: 9px;
    margin-top: 22px;
    border-radius: 20px;
    background: #292929;
    overflow: hidden;
}

#trimProgressBar {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg,#a7792e,#f4d58a);
    transition: width .2s;
}

#downloadTrim {
    display: inline-block;
    margin-top: 20px;
    color: #f4d58a;
    padding: 12px 18px;
    border: 1px solid #b58b42;
    border-radius: 8px;
}

@media(max-width:600px) {
    .trim-box {
        padding: 15px;
    }

    .trim-settings {
        grid-template-columns: 1fr;
    }

    .trim-actions button {
        width: 100%;
    }
}
