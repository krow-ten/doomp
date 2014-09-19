require 'sinatra'
require "sinatra/reloader"
require 'mongo'


def mongo 
  begin
    uri  = URI.parse(ENV['MONGOLAB_URI'])
    conn = Mongo::Connection.from_uri(ENV['MONGOLAB_URI'])
    conn.db(uri.path.gsub(/^\//, ''))   
  rescue
    Mongo::Connection.new.db('doomp')
  end
end

def store
  mongo.collection("store")   
end 


get '/' do
  redirect "/#{('a'..'z').to_a.shuffle.first(6).join}"
end

get '/:name' do
  @doomp = store.find_one( name: params[:name] ) || {'content' => ''}
  erb :default
end 

get "/:name/raw" do
  doomp = store.find_one( name: params[:name] ) || {'content' => ''}
  doomp['content']   
end 


post '/:name' do
  store.update( 
    { name:  params[:name] },  
    { '$set' => { name: params[:name], content: params[:content] }}, 
    { upsert: true} 
  )
  "OK"
end






