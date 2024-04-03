from flask import Flask, render_template

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100 * 1000 * 1000
app.config['UPLOAD_EXTENSIONS'] = {'obj', 'glb', 'mtl', 'stl'}
app.config['UPLOAD_PATH'] = 'uploads'


@app.route('/')
def index():
    app.logger.info('Request received!')
    return render_template('index.html')


if __name__  == "__main__":
    app.run(debug=True,host='localhost',port='9010')


